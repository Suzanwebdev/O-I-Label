-- Short-lived inventory holds for pending checkout orders (prevents overselling).

create table if not exists public.inventory_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid not null references public.variants (id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (order_id, variant_id)
);

create index if not exists idx_inventory_holds_variant on public.inventory_holds (variant_id);
create index if not exists idx_inventory_holds_expires on public.inventory_holds (expires_at);
create index if not exists idx_inventory_holds_order on public.inventory_holds (order_id);

alter table public.inventory_holds enable row level security;

comment on table public.inventory_holds is
  'Temporary stock reservations while checkout payment is pending; released on pay, cancel, or expiry.';
