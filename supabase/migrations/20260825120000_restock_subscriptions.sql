-- Restock / "Notify Me When Available" subscriptions (Phase 1).
-- Guest writes go through POST /api/restock-notifications/subscribe (service role).
-- Preferred color/size are demand analytics only; notification scope is product-level (later phase).

create table if not exists public.restock_subscriptions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  email_normalized text not null,
  email_raw text not null,
  customer_id uuid references public.customers (id) on delete set null,
  preferred_color text,
  preferred_size text,
  status text not null default 'active'
    constraint restock_subscriptions_status_check
      check (status in ('active', 'notified', 'unsubscribed', 'cancelled')),
  notified_at timestamptz,
  source text not null default 'pdp',
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restock_subscriptions_unsubscribe_token_key unique (unsubscribe_token)
);

-- One active row per email + product + preference pair (NULL = "Any").
create unique index if not exists idx_restock_subscriptions_active_pref
  on public.restock_subscriptions (
    email_normalized,
    product_id,
    coalesce(preferred_color, ''),
    coalesce(preferred_size, '')
  )
  where status = 'active';

create index if not exists idx_restock_subscriptions_product_status
  on public.restock_subscriptions (product_id, status);

create index if not exists idx_restock_subscriptions_created
  on public.restock_subscriptions (created_at desc);

alter table public.restock_subscriptions enable row level security;

-- No public policies: anon/authenticated cannot SELECT/INSERT/UPDATE/DELETE.
-- Storefront uses the API route with the service role. Admin read policies come later.
