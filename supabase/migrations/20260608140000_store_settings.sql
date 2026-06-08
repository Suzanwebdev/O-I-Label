-- Store Control Center: global storefront availability

create type public.store_status as enum (
  'live',
  'maintenance',
  'pre_launch',
  'presale',
  'holiday_break',
  'inventory_update',
  'private_access'
);

create table if not exists public.store_settings (
  id int primary key default 1 check (id = 1),
  store_status public.store_status not null default 'live',
  maintenance_message text,
  reopening_date timestamptz,
  presale_date timestamptz,
  launch_date timestamptz,
  banner_text text,
  banner_enabled boolean not null default false,
  checkout_enabled boolean not null default true,
  browsing_enabled boolean not null default true,
  countdown_enabled boolean not null default false,
  presale_cta_label text not null default 'Join waitlist',
  instagram_url text,
  whatsapp_url text,
  private_access_password_hash text,
  private_access_ips text[] not null default '{}',
  scheduled_activate_at timestamptz,
  scheduled_deactivate_at timestamptz,
  scheduled_status public.store_status,
  revert_status public.store_status not null default 'live',
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.store_banners (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  href text,
  enabled boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_banners_schedule
  on public.store_banners (enabled, sort_order, starts_at, ends_at);

create table if not exists public.store_access_whitelist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_store_access_whitelist_email
  on public.store_access_whitelist (lower(trim(email)));

alter table public.store_settings enable row level security;
alter table public.store_banners enable row level security;
alter table public.store_access_whitelist enable row level security;

create policy store_settings_public_read on public.store_settings
  for select using (true);

create policy store_banners_public_read on public.store_banners
  for select using (true);

create policy store_settings_staff_write on public.store_settings
  for all using (public.is_store_admin(auth.uid()))
  with check (public.is_store_admin(auth.uid()));

create policy store_banners_staff_write on public.store_banners
  for all using (public.is_store_admin(auth.uid()))
  with check (public.is_store_admin(auth.uid()));

create policy store_access_whitelist_staff on public.store_access_whitelist
  for all using (public.is_store_admin(auth.uid()))
  with check (public.is_store_admin(auth.uid()));

-- Sync legacy maintenance_mode when store is not live
update public.site_settings
set maintenance_mode = false
where id = 1;
