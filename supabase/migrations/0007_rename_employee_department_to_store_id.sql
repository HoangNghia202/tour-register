-- Rename employees.department -> store_id ("Mã siêu thị", the store code).
-- Idempotent: only renames when the old column still exists and the new one does not.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'department'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'store_id'
  ) then
    alter table public.employees rename column department to store_id;
  end if;
end;
$$;
