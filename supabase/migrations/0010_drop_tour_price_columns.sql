-- Tour price no longer depends on companion type; pricing moved to destination_pricing.
alter table public.tours drop column if exists adult_price;
alter table public.tours drop column if exists child_price;
