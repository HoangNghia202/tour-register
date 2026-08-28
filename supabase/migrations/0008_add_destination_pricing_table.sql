-- Route-based pricing: one price per (destination, route).
-- route = 'self' (tự túc) or one of the 7 canonical pickup-point strings.
create table if not exists public.destination_pricing (
  destination  text    not null check (destination in ('da_lat','nha_trang')),
  pickup_point text    not null,
  price        numeric not null default 0,
  primary key (destination, pickup_point)
);

alter table public.destination_pricing enable row level security;

drop policy if exists "destination_pricing_public_read" on public.destination_pricing;
create policy "destination_pricing_public_read" on public.destination_pricing
  for select
  to anon, authenticated
  using (true);

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
