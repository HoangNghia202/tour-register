-- Tour registration backend schema, RLS policies, RPC functions, and seed data.
-- Column names are quoted camelCase to map 1:1 onto src/types/domain.ts, avoiding
-- a separate snake_case <-> camelCase mapping layer in the application code.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists employees (
  "id" text primary key,
  "fullName" text not null,
  "department" text not null,
  "store" text not null,
  "destination" text not null check ("destination" in ('da_lat', 'nha_trang'))
);

create table if not exists tours (
  "id" text primary key,
  "destination" text not null check ("destination" in ('da_lat', 'nha_trang')),
  "name" text not null,
  "startDate" date not null,
  "endDate" date not null,
  "maxCapacity" integer not null default 0,
  "registeredCount" integer not null default 0,
  "adultPrice" numeric not null default 0,
  "childPrice" numeric not null default 0,
  "pdfUrl" text not null default '',
  "imageUrl" text not null default ''
);

create table if not exists registrations (
  "id" uuid primary key default gen_random_uuid(),
  "employeeId" text not null unique references employees ("id"),
  "tourId" text not null references tours ("id"),
  "transportMethod" text not null check ("transportMethod" in ('self', 'tour_bus')),
  "pickupPoint" text,
  "totalPrice" numeric not null default 0,
  "createdAt" timestamptz not null default now()
);

create table if not exists companions (
  "id" uuid primary key default gen_random_uuid(),
  "registrationId" uuid not null references registrations ("id") on delete cascade,
  "fullName" text not null,
  "dob" date not null,
  "gender" text not null check ("gender" in ('male', 'female')),
  "relationship" text not null,
  "type" text not null check ("type" in ('adult', 'child'))
);

create index if not exists companions_registration_id_idx on companions ("registrationId");

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- tours: public read (needed for the Realtime capacity subscription), writes
--   restricted to service_role only (no write policies defined).
-- employees / registrations / companions: no anon/authenticated policies at
--   all -> RLS denies every direct client access. The only client-facing reads
--   are the exact-match SECURITY DEFINER functions below. Full listing/export
--   is served exclusively through the service-role-gated /api/admin/* routes.

alter table employees enable row level security;
alter table tours enable row level security;
alter table registrations enable row level security;
alter table companions enable row level security;

drop policy if exists "tours_public_read" on tours;
create policy "tours_public_read" on tours
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- RPC functions
-- ---------------------------------------------------------------------------

create or replace function find_employee_by_id(p_id text)
returns table (
  "id" text,
  "fullName" text,
  "department" text,
  "store" text,
  "destination" text
)
language sql
security definer
set search_path = public
as $$
  select "id", "fullName", "department", "store", "destination"
  from employees
  where "id" = p_id;
$$;

revoke all on function find_employee_by_id(text) from public;
grant execute on function find_employee_by_id(text) to anon, authenticated, service_role;

create or replace function get_registration_by_employee(p_employee_id text)
returns table (
  "id" uuid,
  "employeeId" text,
  "tourId" text,
  "transportMethod" text,
  "pickupPoint" text,
  "totalPrice" numeric,
  "createdAt" timestamptz,
  "companions" json
)
language sql
security definer
set search_path = public
as $$
  select
    r."id",
    r."employeeId",
    r."tourId",
    r."transportMethod",
    r."pickupPoint",
    r."totalPrice",
    r."createdAt",
    coalesce(
      (
        select json_agg(json_build_object(
          'id', c."id",
          'fullName', c."fullName",
          'dob', c."dob",
          'gender', c."gender",
          'relationship', c."relationship",
          'type', c."type"
        ))
        from companions c
        where c."registrationId" = r."id"
      ),
      '[]'::json
    ) as "companions"
  from registrations r
  where r."employeeId" = p_employee_id;
$$;

revoke all on function get_registration_by_employee(text) from public;
grant execute on function get_registration_by_employee(text) to anon, authenticated, service_role;

create or replace function submit_registration(
  p_employee_id text,
  p_tour_id text,
  p_transport_method text,
  p_pickup_point text,
  p_companions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tour tours%rowtype;
  v_registration_id uuid;
  v_created_at timestamptz;
  v_total numeric := 0;
  v_companion jsonb;
begin
  if exists (select 1 from registrations where "employeeId" = p_employee_id) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  select * into v_tour from tours where "id" = p_tour_id for update;

  if not found then
    raise exception 'TOUR_NOT_FOUND';
  end if;

  if v_tour."registeredCount" >= v_tour."maxCapacity" then
    raise exception 'TOUR_FULL';
  end if;

  for v_companion in select * from jsonb_array_elements(p_companions)
  loop
    if v_companion ->> 'type' = 'adult' then
      v_total := v_total + v_tour."adultPrice";
    else
      v_total := v_total + v_tour."childPrice";
    end if;
  end loop;

  insert into registrations ("employeeId", "tourId", "transportMethod", "pickupPoint", "totalPrice")
  values (p_employee_id, p_tour_id, p_transport_method, p_pickup_point, v_total)
  returning "id", "createdAt" into v_registration_id, v_created_at;

  insert into companions ("registrationId", "fullName", "dob", "gender", "relationship", "type")
  select
    v_registration_id,
    c ->> 'fullName',
    (c ->> 'dob')::date,
    c ->> 'gender',
    c ->> 'relationship',
    c ->> 'type'
  from jsonb_array_elements(p_companions) as c;

  update tours set "registeredCount" = "registeredCount" + 1 where "id" = p_tour_id;

  return jsonb_build_object(
    'id', v_registration_id,
    'employeeId', p_employee_id,
    'tourId', p_tour_id,
    'transportMethod', p_transport_method,
    'pickupPoint', p_pickup_point,
    'companions', (
      select coalesce(json_agg(json_build_object(
        'id', c."id",
        'fullName', c."fullName",
        'dob', c."dob",
        'gender', c."gender",
        'relationship', c."relationship",
        'type', c."type"
      )), '[]'::json)
      from companions c
      where c."registrationId" = v_registration_id
    ),
    'totalPrice', v_total,
    'createdAt', v_created_at
  );
end;
$$;

revoke all on function submit_registration(text, text, text, text, jsonb) from public;
grant execute on function submit_registration(text, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: expose capacity changes on `tours` for the tour selection screen.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tours'
  ) then
    alter publication supabase_realtime add table tours;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed data: the 5 tours (1 Đà Lạt, 4 Nha Trang) per the original design spec.
-- ---------------------------------------------------------------------------

insert into tours (
  "id", "destination", "name", "startDate", "endDate",
  "maxCapacity", "registeredCount", "adultPrice", "childPrice", "pdfUrl", "imageUrl"
)
values
  ('dalat-1', 'da_lat', 'Đà Lạt', '2026-09-28', '2026-09-30', 750, 0, 2500000, 1200000,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg'),
  ('nha-trang-1', 'nha_trang', 'Nha Trang 1', '2026-09-28', '2026-09-30', 450, 0, 2850000, 1400000,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg'),
  ('nha-trang-2', 'nha_trang', 'Nha Trang 2', '2026-10-07', '2026-10-09', 450, 0, 2950000, 1500000,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg'),
  ('nha-trang-3', 'nha_trang', 'Nha Trang 3', '2026-10-19', '2026-10-21', 450, 0, 3050000, 1550000,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg'),
  ('nha-trang-4', 'nha_trang', 'Nha Trang 4', '2026-10-21', '2026-10-23', 450, 0, 3150000, 1600000,
   'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '/placeholder-tour.svg')
on conflict ("id") do nothing;

