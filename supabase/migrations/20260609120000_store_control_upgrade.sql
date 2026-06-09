-- Store Control upgrade: soft close, hero images, waitlist, campaigns, access log

alter type public.store_status add value if not exists 'soft_close';

alter table public.store_settings
  add column if not exists presale_hero_image_url text,
  add column if not exists maintenance_hero_image_url text,
  add column if not exists launch_hero_image_url text,
  add column if not exists supporting_message text,
  add column if not exists scheduled_timezone text not null default 'Africa/Accra',
  add column if not exists show_waitlist_count boolean not null default true,
  add column if not exists maintenance_use_503 boolean not null default false;

create table if not exists public.store_waitlist (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  email_normalized text not null,
  email_raw text not null,
  phone_e164 text,
  country_iso text not null default 'GH',
  source text not null default 'presale',
  product_slug text,
  welcome_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_store_waitlist_email
  on public.store_waitlist (lower(trim(email_normalized)));

create index if not exists idx_store_waitlist_created
  on public.store_waitlist (created_at desc);

create index if not exists idx_store_waitlist_source
  on public.store_waitlist (source, created_at desc);

create table if not exists public.store_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_type text not null,
  subject text not null,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  status text not null default 'pending',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.store_access_attempts (
  id uuid primary key default gen_random_uuid(),
  email text,
  ip text,
  success boolean not null default false,
  method text,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_access_attempts_created
  on public.store_access_attempts (created_at desc);

alter table public.store_waitlist enable row level security;
alter table public.store_email_campaigns enable row level security;
alter table public.store_access_attempts enable row level security;

create policy store_waitlist_staff on public.store_waitlist
  for all using (public.is_store_admin(auth.uid()))
  with check (public.is_store_admin(auth.uid()));

create policy store_email_campaigns_staff on public.store_email_campaigns
  for all using (public.is_store_admin(auth.uid()))
  with check (public.is_store_admin(auth.uid()));

create policy store_access_attempts_staff on public.store_access_attempts
  for select using (public.is_store_admin(auth.uid()));

create policy store_access_attempts_insert on public.store_access_attempts
  for insert with check (true);
