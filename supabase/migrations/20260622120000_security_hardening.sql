-- Tighten store control secrets and access logging

-- Remove public read of sensitive store_settings columns (password hash, IP allowlist).
drop policy if exists store_settings_public_read on public.store_settings;

create or replace view public.store_settings_public as
select
  id,
  store_status,
  maintenance_message,
  supporting_message,
  reopening_date,
  presale_date,
  launch_date,
  banner_text,
  banner_enabled,
  checkout_enabled,
  browsing_enabled,
  countdown_enabled,
  presale_cta_label,
  presale_hero_image_url,
  maintenance_hero_image_url,
  launch_hero_image_url,
  instagram_url,
  whatsapp_url,
  scheduled_activate_at,
  scheduled_deactivate_at,
  scheduled_status,
  scheduled_timezone,
  revert_status,
  show_waitlist_count,
  maintenance_use_503,
  updated_at
from public.store_settings
where id = 1;

grant select on public.store_settings_public to anon, authenticated;

-- Only service role / staff API should insert access attempt logs.
drop policy if exists store_access_attempts_insert on public.store_access_attempts;

-- Atomic paid-order stock deduction (prevents oversell under concurrent payments).
create or replace function public.deduct_variant_stock(p_variant_id uuid, p_quantity int)
returns table (variant_id uuid, stock_after int)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.variants v
  set stock = v.stock - p_quantity
  where v.id = p_variant_id
    and v.stock >= p_quantity
  returning v.id, v.stock;
end;
$$;

revoke all on function public.deduct_variant_stock(uuid, int) from public;
grant execute on function public.deduct_variant_stock(uuid, int) to service_role;
