-- Alternative migration for deployments that use snake_case columns.
-- Capacity rule update:
--   each registration consumes 1 slot for the employee
--   + number of adult companions.

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
  v_max_capacity int;
  v_registered_count int;
  v_registration_id bigint;
  v_slot_count int := 1;
  v_total_price numeric := 0;
  c jsonb;
begin
  -- Capacity = employee (1) + adult companions.
  select 1 + coalesce(sum(case when item ->> 'type' = 'adult' then 1 else 0 end), 0)
  into v_slot_count
  from jsonb_array_elements(p_companions) as item;

  select max_capacity, registered_count
  into v_max_capacity, v_registered_count
  from public.tours
  where id = p_tour_id
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

  -- Recompute total price server-side.
  for c in select * from jsonb_array_elements(p_companions)
  loop
    if c ->> 'type' = 'adult' then
      select v_total_price + adult_price into v_total_price from public.tours where id = p_tour_id;
    else
      select v_total_price + child_price into v_total_price from public.tours where id = p_tour_id;
    end if;
  end loop;

  insert into public.registrations (employee_id, tour_id, transport_method, pickup_point, total_price)
  values (p_employee_id, p_tour_id, p_transport_method, p_pickup_point, v_total_price)
  returning id into v_registration_id;

  for c in select * from jsonb_array_elements(p_companions)
  loop
    insert into public.companions (registration_id, full_name, dob, gender, relationship, type)
    values (
      v_registration_id,
      coalesce(c ->> 'full_name', c ->> 'fullName'),
      (c ->> 'dob')::date,
      c ->> 'gender',
      c ->> 'relationship',
      c ->> 'type'
    );
  end loop;

  update public.tours
  set registered_count = registered_count + v_slot_count
  where id = p_tour_id;

  return jsonb_build_object(
    'success', true,
    'registration_id', v_registration_id,
    'total_price', v_total_price,
    'slot_count', v_slot_count
  );
end;
$$;

