-- O & I Label — initial schema + RLS + storage bucket definitions
-- Run after creating a Supabase project; apply via Supabase CLI or SQL editor.

create extension if not exists "pgcrypto";

-- ——— Enums ———
do $$ begin
  create type public.order_status as enum (
    'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending', 'processing', 'paid', 'failed', 'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.admin_role as enum ('superadmin', 'admin', 'staff');
exception when duplicate_object then null;
end $$;

-- ——— Core tables ———
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'O & I Label',
  maintenance_mode boolean not null default false,
  feature_flags jsonb not null default '{}',
  payment_moolre_enabled boolean not null default true,
  payment_paystack_enabled boolean not null default false,
  payment_flutterwave_enabled boolean not null default false,
  shipping_zones jsonb default '[]',
  tax_enabled boolean not null default false,
  analytics_ga4 text,
  analytics_meta text,
  analytics_tiktok text,
  rate_limit_per_min int default 120,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  is_smart boolean not null default false,
  smart_rules jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  badges text[] not null default '{}',
  rating numeric(3,2),
  review_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  alt text
);

create table if not exists public.attributes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.attributes (id) on delete cascade,
  value text not null,
  unique (attribute_id, value)
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  price_ghs numeric(12,2) not null,
  compare_at_ghs numeric(12,2),
  stock int not null default 0,
  size text,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants (id) on delete cascade,
  delta int not null,
  reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  primary key (collection_id, product_id)
);

create table if not exists public.customers (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  tags text[] default '{}',
  total_spend_ghs numeric(14,2) default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  line1 text not null,
  line2 text,
  city text not null,
  region text,
  country text not null default 'GH',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete cascade,
  session_id text,
  created_at timestamptz not null default now(),
  constraint wishlists_owner check (
    customer_id is not null or session_id is not null
  )
);

create table if not exists public.wishlist_items (
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.variants (id) on delete set null,
  primary key (wishlist_id, product_id)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete cascade,
  session_id text,
  updated_at timestamptz not null default now(),
  constraint carts_owner check (customer_id is not null or session_id is not null)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.variants (id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  unique (cart_id, variant_id)
);

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent', 'fixed', 'free_shipping')),
  value numeric(12,2),
  min_spend_ghs numeric(12,2),
  usage_limit int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.customers (id) on delete set null,
  email text not null,
  phone text,
  status public.order_status not null default 'pending',
  subtotal_ghs numeric(14,2) not null,
  shipping_ghs numeric(14,2) not null default 0,
  tax_ghs numeric(14,2) not null default 0,
  discount_ghs numeric(14,2) not null default 0,
  total_ghs numeric(14,2) not null,
  currency text not null default 'GHS',
  shipping_address jsonb,
  billing_address jsonb,
  notes text,
  notify_customer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.variants (id) on delete set null,
  name text not null,
  sku text,
  unit_price_ghs numeric(12,2) not null,
  quantity int not null check (quantity > 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  reference text,
  amount_ghs numeric(14,2) not null,
  status public.payment_status not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  carrier text,
  tracking_number text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reason text,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  rating int not null check (rating >= 1 and rating <= 5),
  body text,
  verified_purchase boolean not null default false,
  photos text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null,
  published boolean not null default false,
  cover_path text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.home_content (
  id int primary key default 1 check (id = 1),
  sections jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.home_content (id) values (1) on conflict (id) do nothing;

create table if not exists public.policy_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text,
  payload jsonb,
  signature_ok boolean,
  processed boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.superadmins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  role public.admin_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  meta jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  source text,
  message text not null,
  stack text,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- ——— Indexes ———
create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_active on public.products (is_active);
create index if not exists idx_variants_product on public.variants (product_id);
create index if not exists idx_orders_customer on public.orders (customer_id);
create index if not exists idx_orders_number on public.orders (order_number);
create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_webhook_logs_created on public.webhook_logs (created_at desc);

-- ——— Helper functions ———
create or replace function public.is_superadmin(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.superadmins s where s.user_id = uid);
$$;

create or replace function public.is_store_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = uid and a.role in ('admin', 'staff', 'superadmin')
  );
$$;

create or replace function public.can_manage_catalog(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_superadmin(uid) or exists (
    select 1 from public.admins a where a.user_id = uid and a.role in ('admin', 'staff')
  );
$$;

-- ——— RLS ———
alter table public.site_settings enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.attributes enable row level security;
alter table public.attribute_values enable row level security;
alter table public.variants enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.collection_products enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.discounts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.returns enable row level security;
alter table public.reviews enable row level security;
alter table public.blog_posts enable row level security;
alter table public.home_content enable row level security;
alter table public.policy_pages enable row level security;
alter table public.webhook_logs enable row level security;
alter table public.superadmins enable row level security;
alter table public.admins enable row level security;
alter table public.audit_logs enable row level security;
alter table public.error_logs enable row level security;

-- Public catalog read
create policy products_public_read on public.products
  for select using (is_active = true);

create policy categories_public_read on public.categories
  for select using (true);

create policy collections_public_read on public.collections
  for select using (true);

create policy collection_products_public_read on public.collection_products
  for select using (true);

create policy product_images_public_read on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

create policy variants_public_read on public.variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

create policy blog_public_read on public.blog_posts
  for select using (published = true);

create policy home_public_read on public.home_content
  for select using (true);

create policy policy_pages_public_read on public.policy_pages
  for select using (true);

create policy site_settings_public_read on public.site_settings
  for select using (true);

-- Customers: own profile & related
create policy customers_self on public.customers
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy addresses_self on public.addresses
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy orders_self on public.orders
  for select using (customer_id = auth.uid());

create policy order_items_order on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

-- Staff catalog write (simplified: admins/superadmins)
create policy products_staff_write on public.products
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy variants_staff_write on public.variants
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy product_images_staff on public.product_images
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy categories_staff on public.categories
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy collections_staff on public.collections
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy collection_products_staff on public.collection_products
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy orders_staff on public.orders
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy order_items_staff on public.order_items
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy discounts_staff on public.discounts
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy blog_staff on public.blog_posts
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy home_staff on public.home_content
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy policy_pages_staff on public.policy_pages
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

create policy inventory_staff on public.inventory_movements
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

-- Superadmin-only
create policy webhook_logs_super on public.webhook_logs
  for select using (public.is_superadmin(auth.uid()));

create policy audit_logs_super on public.audit_logs
  for select using (public.is_superadmin(auth.uid()));

create policy error_logs_super on public.error_logs
  for select using (public.is_superadmin(auth.uid()));

create policy superadmins_super on public.superadmins
  for select using (public.is_superadmin(auth.uid()));

create policy admins_super_read on public.admins
  for select using (public.is_superadmin(auth.uid()) or auth.uid() = user_id);

create policy site_settings_super_write on public.site_settings
  for update using (public.is_superadmin(auth.uid()));

-- Service role bypasses RLS by default when using service key in API routes

-- ——— Storage buckets (create in Dashboard or SQL) ———
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('blog-covers', 'blog-covers', true),
  ('site-media', 'site-media', true),
  ('documents', 'documents', false)
on conflict (id) do nothing;

-- Public read for public buckets
create policy "Public read product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Public read blog covers"
on storage.objects for select
using (bucket_id = 'blog-covers');

create policy "Public read site media"
on storage.objects for select
using (bucket_id = 'site-media');

create policy "Staff upload product images"
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and public.can_manage_catalog(auth.uid())
);

create policy "Staff update product images"
on storage.objects for update
using (
  bucket_id = 'product-images'
  and public.can_manage_catalog(auth.uid())
);
