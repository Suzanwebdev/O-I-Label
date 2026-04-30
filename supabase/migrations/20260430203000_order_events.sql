create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_events_order_created
  on public.order_events (order_id, created_at desc);

alter table public.order_events enable row level security;

create policy order_events_staff_select on public.order_events
  for select using (public.is_store_admin(auth.uid()));

create policy order_events_staff_insert on public.order_events
  for insert with check (public.is_store_admin(auth.uid()));
