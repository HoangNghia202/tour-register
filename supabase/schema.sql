-- =============================================================================
-- FULL SCHEMA SNAPSHOT — run this once to provision a fresh database.
--
-- Equivalent to applying migrations 0001 → 0011 in order, but flattened to the
-- final state:
--   * snake_case columns throughout (the style the live project uses).
--   * tours has no adult_price / child_price (pricing lives in destination_pricing).
--   * registrations.resubmit_count + resubmit_registration() (one "đăng ký lại").
--   * submit_registration() prices from destination_pricing:
--       total_price = route price * (1 + number of adult companions).
--
-- Safe to re-run: every statement is idempotent (if not exists / or replace /
-- drop ... if exists). Existing rows are preserved; seed inserts are no-ops on
-- conflict.
--
-- The migrations/ folder is kept only as history — this file supersedes it.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.employees (
  id           text primary key,
  full_name    text not null,
  store_id     text not null,
  store        text not null,
  destination  text not null check (destination in ('da_lat', 'nha_trang'))
);

create table if not exists public.tours (
  id               text primary key,
  destination      text    not null check (destination in ('da_lat', 'nha_trang')),
  name             text    not null,
  start_date       date    not null,
  end_date         date    not null,
  max_capacity     integer not null default 0,
  registered_count integer not null default 0,
  pdf_url          text    not null default '',
  image_url        text    not null default ''
);

create table if not exists public.registrations (
  id               bigint generated always as identity primary key,
  employee_id      text    not null unique references public.employees (id),
  tour_id          text    not null references public.tours (id),
  transport_method text    not null check (transport_method in ('self', 'tour_bus')),
  pickup_point     text,
  total_price      numeric not null default 0,
  resubmit_count   integer not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.companions (
  id              bigint generated always as identity primary key,
  registration_id bigint not null references public.registrations (id) on delete cascade,
  full_name       text   not null,
  dob             date   not null,
  gender          text   not null check (gender in ('male', 'female')),
  relationship    text   not null,
  type            text   not null check (type in ('adult', 'child'))
);

create index if not exists companions_registration_id_idx
  on public.companions (registration_id);

create table if not exists public.destination_pricing (
  destination  text    not null check (destination in ('da_lat', 'nha_trang')),
  pickup_point text    not null,
  price        numeric not null default 0,
  primary key (destination, pickup_point)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--   tours / destination_pricing: public read (Realtime + price table).
--   employees / registrations / companions: no anon policy at all -> every
--   direct client access is denied; clients only reach them through the
--   exact-match SECURITY DEFINER functions below. Bulk listing/export is
--   service-role only, via /api/admin/*.
-- ---------------------------------------------------------------------------

alter table public.employees          enable row level security;
alter table public.tours              enable row level security;
alter table public.registrations      enable row level security;
alter table public.companions         enable row level security;
alter table public.destination_pricing enable row level security;

drop policy if exists "tours_public_read" on public.tours;
create policy "tours_public_read" on public.tours
  for select to anon, authenticated using (true);

drop policy if exists "destination_pricing_public_read" on public.destination_pricing;
create policy "destination_pricing_public_read" on public.destination_pricing
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- find_employee_by_id — exact-match lookup, no enumeration.
-- ---------------------------------------------------------------------------

create or replace function public.find_employee_by_id(p_id text)
returns table (
  id          text,
  full_name   text,
  store_id    text,
  store       text,
  destination text
)
language sql
security definer
set search_path = public
as $$
  select id, full_name, store_id, store, destination
  from public.employees
  where id = p_id;
$$;

revoke all on function public.find_employee_by_id(text) from public;
grant execute on function public.find_employee_by_id(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_registration_by_employee — one employee's registration + companions,
-- including resubmit_count so the client can hide the "Đăng ký lại" button.
-- ---------------------------------------------------------------------------

drop function if exists public.get_registration_by_employee(text);

create or replace function public.get_registration_by_employee(p_employee_id text)
returns table (
  id               bigint,
  employee_id      text,
  tour_id          text,
  transport_method text,
  pickup_point     text,
  total_price      numeric,
  resubmit_count   integer,
  created_at       timestamptz,
  companions       json
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.employee_id,
    r.tour_id::text,
    r.transport_method,
    r.pickup_point,
    r.total_price,
    r.resubmit_count,
    r.created_at,
    coalesce(
      (
        select json_agg(json_build_object(
          'id', c.id,
          'fullName', c.full_name,
          'dob', c.dob,
          'gender', c.gender,
          'relationship', c.relationship,
          'type', c.type
        ))
        from public.companions c
        where c.registration_id = r.id
      ),
      '[]'::json
    ) as companions
  from public.registrations r
  where r.employee_id = p_employee_id;
$$;

revoke all on function public.get_registration_by_employee(text) from public;
grant execute on function public.get_registration_by_employee(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- submit_registration — capacity + route pricing + inserts, all in one tx.
--   capacity consumed = 1 (employee) + number of adult companions.
--   total_price = destination_pricing.price(tour.destination, route) * capacity,
--     where route = 'self' or the pickup point.
--   companion caps: <= 4 adults, <= 2 children.
--   p_total_price is accepted for signature stability but ignored.
-- ---------------------------------------------------------------------------

drop function if exists public.submit_registration(text, bigint, text, text, numeric, jsonb);
drop function if exists public.submit_registration(text, text, text, text, numeric, jsonb);

create or replace function public.submit_registration(
  p_employee_id text,
  p_tour_id text,
  p_transport_method text,
  p_pickup_point text,
  p_total_price numeric,
  p_companions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tour_id public.tours.id%type;
  v_destination text;
  v_max_capacity int;
  v_registered_count int;
  v_registration_id bigint;
  v_adult_count int := 0;
  v_child_count int := 0;
  v_slot_count int := 1;
  v_route_key text;
  v_route_price numeric;
  v_total_price numeric := 0;
begin
  select
    coalesce(sum(case when item ->> 'type' = 'adult' then 1 else 0 end), 0),
    coalesce(sum(case when item ->> 'type' = 'child' then 1 else 0 end), 0)
  into v_adult_count, v_child_count
  from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb)) as item;

  if v_adult_count > 4 then
    raise exception 'TOO_MANY_ADULTS';
  end if;
  if v_child_count > 2 then
    raise exception 'TOO_MANY_CHILDREN';
  end if;

  v_slot_count := 1 + v_adult_count;

  select id, destination, max_capacity, registered_count
  into v_tour_id, v_destination, v_max_capacity, v_registered_count
  from public.tours
  where id::text = p_tour_id
  for update;

  if not found then
    raise exception 'TOUR_NOT_FOUND';
  end if;

  if v_registered_count + v_slot_count > v_max_capacity then
    raise exception 'TOUR_FULL';
  end if;

  if exists (select 1 from public.registrations where employee_id = p_employee_id) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  v_route_key := case when p_transport_method = 'self' then 'self' else p_pickup_point end;

  select price into v_route_price
  from public.destination_pricing
  where destination = v_destination and pickup_point = v_route_key;

  if not found then
    raise exception 'ROUTE_PRICE_NOT_FOUND';
  end if;

  v_total_price := v_route_price * v_slot_count;

  insert into public.registrations (employee_id, tour_id, transport_method, pickup_point, total_price)
  values (p_employee_id, v_tour_id, p_transport_method, p_pickup_point, v_total_price)
  returning id into v_registration_id;

  insert into public.companions (registration_id, full_name, dob, gender, relationship, type)
  select
    v_registration_id,
    coalesce(c ->> 'full_name', c ->> 'fullName'),
    (c ->> 'dob')::date,
    c ->> 'gender',
    c ->> 'relationship',
    c ->> 'type'
  from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb)) as c;

  update public.tours
  set registered_count = registered_count + v_slot_count
  where id = v_tour_id;

  return jsonb_build_object(
    'success', true,
    'registration_id', v_registration_id,
    'total_price', v_total_price,
    'slot_count', v_slot_count,
    'tour_id', v_tour_id
  );
end;
$$;

revoke all on function public.submit_registration(text, text, text, text, numeric, jsonb) from public;
grant execute on function public.submit_registration(text, text, text, text, numeric, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- resubmit_registration — one-time "đăng ký lại" allowance per employee.
--   Wipes the previous registration + companions, releases the capacity it
--   held on tours.registered_count, then delegates to submit_registration()
--   for the normal capacity / pricing / insert path and stamps
--   resubmit_count = 1 on the new row. Whole thing is one transaction, so a
--   TOUR_FULL (or any other) failure rolls the delete back — the employee
--   keeps the original registration.
-- ---------------------------------------------------------------------------

drop function if exists public.resubmit_registration(text, text, text, text, numeric, jsonb);

create or replace function public.resubmit_registration(
  p_employee_id text,
  p_tour_id text,
  p_transport_method text,
  p_pickup_point text,
  p_total_price numeric,
  p_companions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_id          public.registrations.id%type;
  v_old_tour_id     text;
  v_old_resubmit    int;
  v_old_adult_count int := 0;
  v_old_slot_count  int := 1;
  v_result          jsonb;
begin
  select id, tour_id::text, coalesce(resubmit_count, 0)
  into v_old_id, v_old_tour_id, v_old_resubmit
  from public.registrations
  where employee_id = p_employee_id
  for update;

  if not found then
    raise exception 'NO_EXISTING_REGISTRATION';
  end if;

  if v_old_resubmit >= 1 then
    raise exception 'RESUBMIT_LIMIT_REACHED';
  end if;

  select coalesce(sum(case when type = 'adult' then 1 else 0 end), 0)
  into v_old_adult_count
  from public.companions
  where registration_id = v_old_id;

  v_old_slot_count := 1 + v_old_adult_count;

  -- release the capacity held by the previous registration
  update public.tours
  set registered_count = greatest(registered_count - v_old_slot_count, 0)
  where id::text = v_old_tour_id;

  -- wipe the previous registration (companions cascade on delete)
  delete from public.registrations where id = v_old_id;

  -- normal path: capacity check on the new tour, route pricing, inserts, count bump
  v_result := public.submit_registration(
    p_employee_id,
    p_tour_id,
    p_transport_method,
    p_pickup_point,
    p_total_price,
    p_companions
  );

  update public.registrations
  set resubmit_count = 1
  where employee_id = p_employee_id;

  return v_result || jsonb_build_object('resubmit_count', 1);
end;
$$;

revoke all on function public.resubmit_registration(text, text, text, text, numeric, jsonb) from public;
grant execute on function public.resubmit_registration(text, text, text, text, numeric, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: expose capacity changes on `tours` for the tour selection screen.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tours'
  ) then
    alter publication supabase_realtime add table public.tours;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into public.tours (
  id, destination, name, start_date, end_date,
  max_capacity, registered_count, pdf_url, image_url
)
values
  ('dalat-1',     'da_lat',    'Đà Lạt',      '2026-09-28', '2026-09-30', 750, 0,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg'),
  ('nha-trang-1', 'nha_trang', 'Nha Trang 1', '2026-09-28', '2026-09-30', 450, 0,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg'),
  ('nha-trang-2', 'nha_trang', 'Nha Trang 2', '2026-10-07', '2026-10-09', 450, 0,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg'),
  ('nha-trang-3', 'nha_trang', 'Nha Trang 3', '2026-10-19', '2026-10-21', 450, 0,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg'),
  ('nha-trang-4', 'nha_trang', 'Nha Trang 4', '2026-10-21', '2026-10-23', 450, 0,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg')
on conflict (id) do nothing;

insert into public.destination_pricing (destination, pickup_point, price) values
  ('da_lat',    'self',        3080000),
  ('da_lat',    'Hà Tĩnh',     4415000),
  ('da_lat',    'Quảng Bình',  4245000),
  ('da_lat',    'Quảng Trị',   4220000),
  ('da_lat',    'TP. Huế',     4160000),
  ('da_lat',    'Đà Nẵng',     4055000),
  ('da_lat',    'Quảng Nam',   4045000),
  ('da_lat',    'Quảng Ngãi',  3995000),
  ('nha_trang', 'self',        3200000),
  ('nha_trang', 'Hà Tĩnh',     4420000),
  ('nha_trang', 'Quảng Bình',  4360000),
  ('nha_trang', 'Quảng Trị',   4310000),
  ('nha_trang', 'TP. Huế',     4280000),
  ('nha_trang', 'Đà Nẵng',     4120000),
  ('nha_trang', 'Quảng Nam',   4105000),
  ('nha_trang', 'Quảng Ngãi',  4040000)
on conflict (destination, pickup_point) do nothing;
