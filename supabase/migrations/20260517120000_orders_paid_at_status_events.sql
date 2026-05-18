-- Payment timestamp on orders + dedicated fulfillment status audit trail

alter table public.orders
  add column if not exists paid_at timestamptz;

comment on column public.orders.paid_at is 'Set once when payment is confirmed; never cleared.';

-- Backfill from successful payments
update public.orders o
set paid_at = sub.paid_at
from (
  select p.order_id, min(coalesce(p.updated_at, p.created_at)) as paid_at
  from public.payments p
  where p.status = 'paid'
  group by p.order_id
) sub
where o.id = sub.order_id
  and o.paid_at is null;

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  payment_status public.payment_status,
  actor_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_status_events_order_created
  on public.order_status_events (order_id, created_at desc);

alter table public.order_status_events enable row level security;

create policy order_status_events_staff_select on public.order_status_events
  for select using (public.is_store_admin(auth.uid()));

create policy order_status_events_staff_insert on public.order_status_events
  for insert with check (public.is_store_admin(auth.uid()));
