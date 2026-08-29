-- One-time "đăng ký lại" (register again) allowance per employee.
--
--   * Adds registrations.resubmit_count (0 = chưa dùng, 1 = đã dùng lượt đăng ký lại).
--   * get_registration_by_employee now also returns resubmit_count so the client
--     can hide the "Đăng ký lại" button once it has been used.
--   * resubmit_registration() wipes the previous registration + companions, releases
--     the capacity it held on tours.registered_count, then delegates to
--     submit_registration() for the normal capacity / pricing / insert path and
--     stamps resubmit_count = 1 on the new row.
--
-- Assumes snake_case columns (consistent with 0009_submit_registration_route_pricing.sql).

alter table public.registrations
  add column if not exists resubmit_count int not null default 0;

-- ---------------------------------------------------------------------------
-- get_registration_by_employee: expose resubmit_count
-- ---------------------------------------------------------------------------
drop function if exists public.get_registration_by_employee(text);

create or replace function public.get_registration_by_employee(p_employee_id text)
returns table (
  id                bigint,
  employee_id       text,
  tour_id           text,
  transport_method  text,
  pickup_point      text,
  total_price       numeric,
  resubmit_count    int,
  created_at        timestamptz,
  companions        json
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
-- resubmit_registration: delete the old registration, then re-run submit path
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

-- Called only through /api/register (service-role), same as submit_registration.
revoke all on function public.resubmit_registration(text, text, text, text, numeric, jsonb) from public;
grant execute on function public.resubmit_registration(text, text, text, text, numeric, jsonb) to service_role;
