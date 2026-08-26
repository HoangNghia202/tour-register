-- Update capacity logic: each registration consumes
--   1 slot for the employee + number of adult companions.
-- Child companions do not consume capacity slots.

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
  v_slot_count integer := 1;
  v_companion jsonb;
begin
  if exists (select 1 from registrations where "employeeId" = p_employee_id) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  -- Capacity rule: employee (1) + number of adult companions.
  select 1 + coalesce(sum(case when c ->> 'type' = 'adult' then 1 else 0 end), 0)
  into v_slot_count
  from jsonb_array_elements(p_companions) as c;

  select * into v_tour from tours where "id" = p_tour_id for update;

  if not found then
    raise exception 'TOUR_NOT_FOUND';
  end if;

  if v_tour."registeredCount" + v_slot_count > v_tour."maxCapacity" then
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

  update tours
  set "registeredCount" = "registeredCount" + v_slot_count
  where "id" = p_tour_id;

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
    'createdAt', v_created_at,
    'slotCount', v_slot_count
  );
end;
$$;

