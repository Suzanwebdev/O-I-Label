-- Admin marketing workspace: campaigns, channel notes, checklists, UTM presets.
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  channel_notes text,
  checklist jsonb not null default '[]'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_campaigns_created_at_idx on public.marketing_campaigns (created_at desc);

alter table public.marketing_campaigns enable row level security;

create policy marketing_campaigns_staff on public.marketing_campaigns
  for all using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));
