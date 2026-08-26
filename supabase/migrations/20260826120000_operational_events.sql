-- Phase 4C: operational event capture foundation for Website Health dashboards.
-- Service-role writes only. No public/anon access.

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null,
  fingerprint text not null,
  severity text not null
    constraint operational_events_severity_check
      check (severity in ('info', 'warning', 'error', 'critical')),
  category text not null
    constraint operational_events_category_check
      check (category in (
        'checkout',
        'payment',
        'webhook',
        'inventory',
        'email',
        'restock',
        'auth',
        'api'
      )),
  surface text not null
    constraint operational_events_surface_check
      check (surface in ('storefront', 'admin', 'superadmin', 'webhook', 'cron')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1
    constraint operational_events_occurrence_count_check
      check (occurrence_count >= 1),
  status text not null default 'open'
    constraint operational_events_status_check
      check (status in ('open', 'acknowledged', 'resolved')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open row per fingerprint for aggregation / deduplication.
create unique index if not exists idx_operational_events_open_fingerprint
  on public.operational_events (fingerprint)
  where status = 'open';

create index if not exists idx_operational_events_status_last_seen
  on public.operational_events (status, last_seen_at desc);

create index if not exists idx_operational_events_category_last_seen
  on public.operational_events (category, last_seen_at desc);

create index if not exists idx_operational_events_incident_id
  on public.operational_events (incident_id);

alter table public.operational_events enable row level security;

-- Future Admin / Superadmin dashboards may read via authenticated client.
-- Writes remain service-role only (no INSERT/UPDATE/DELETE policies).
create policy operational_events_staff_select on public.operational_events
  for select
  using (public.is_store_admin(auth.uid()) or public.is_superadmin(auth.uid()));
