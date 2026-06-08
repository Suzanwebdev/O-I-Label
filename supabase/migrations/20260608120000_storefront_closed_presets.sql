alter table public.site_settings
  add column if not exists storefront_closed_preset text not null default 'maintenance';

alter table public.site_settings
  add column if not exists storefront_closed_copy jsonb not null default '{}';

alter table public.site_settings
  drop constraint if exists site_settings_storefront_closed_preset_check;

alter table public.site_settings
  add constraint site_settings_storefront_closed_preset_check
  check (storefront_closed_preset in ('maintenance', 'sale_prep', 'closed'));

comment on column public.site_settings.storefront_closed_preset is
  'Which customer-facing message preset to show when maintenance_mode is on';

comment on column public.site_settings.storefront_closed_copy is
  'Optional title/message overrides per preset key: maintenance, sale_prep, closed';
