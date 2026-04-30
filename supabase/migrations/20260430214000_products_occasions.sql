alter table public.products
  add column if not exists occasions text[] not null default '{}';

create index if not exists idx_products_occasions
  on public.products using gin (occasions);
