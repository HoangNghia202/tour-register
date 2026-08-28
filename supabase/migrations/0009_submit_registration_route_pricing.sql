-- submit_registration: price now comes from destination_pricing keyed by
-- (tour.destination, route), where route = 'self' or the pickup point.
-- total_price = route price * (1 + number of adult companions).
-- Enforces companion caps: <= 4 adults, <= 2 children.
-- p_total_price is accepted for signature stability but ignored (server is authoritative).

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
