create table if not exists public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index if not exists idx_product_categories_category
  on public.product_categories (category_id);

insert into public.product_categories (product_id, category_id)
select id, category_id
from public.products
where category_id is not null
on conflict do nothing;

alter table public.product_categories enable row level security;

create policy product_categories_public_read on public.product_categories
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

create policy product_categories_staff on public.product_categories
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));
