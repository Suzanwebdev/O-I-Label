-- Marketing / newsletter opt-ins (footer form). Writes go through POST /api/newsletter/subscribe (service role).
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null constraint newsletter_subscribers_email_normalized_key unique,
  email_raw text not null,
  phone_e164 text not null,
  country_iso text not null default 'GH',
  source text not null default 'footer',
  email_promo_opt_in boolean not null default true,
  sms_promo_opt_in boolean not null default true,
  welcome_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_newsletter_subscribers_created
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

-- No policies: only service-role / dashboard can access; storefront uses the API route.
