-- Applied directly to production on 2026-11-06 inside a single BEGIN ... COMMIT.
-- The Supabase CLI wraps each migration in its own transaction, so BEGIN/COMMIT are omitted here.
-- Every statement is idempotent (CREATE OR REPLACE, REVOKE, GRANT); re-running is a no-op.

-- deduct_variant_stock: reject zero, negative and null quantities. The conditional
-- UPDATE (stock >= quantity, zero rows on shortage) is unchanged. CREATE OR REPLACE
-- keeps the owner and existing grants.
create or replace function public.deduct_variant_stock(p_variant_id uuid, p_quantity integer)
returns table(variant_id uuid, stock_after integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'deduct_variant_stock: quantity must be positive (got %)', p_quantity
      using errcode = '22023';
  end if;

  return query
  update public.variants v
  set stock = v.stock - p_quantity
  where v.id = p_variant_id
    and v.stock >= p_quantity
  returning v.id, v.stock;
end;
$function$;

-- Supabase default privileges grant EXECUTE to anon/authenticated directly, so revoking
-- from PUBLIC alone (as in 20260622120000_security_hardening.sql) was not sufficient.
revoke execute on function public.deduct_variant_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.deduct_variant_stock(uuid, integer) to service_role;

-- The view runs with its owner's rights and is auto-updatable, so write grants let
-- anon/authenticated modify store_settings. SELECT is intentionally kept.
revoke insert, update, delete, truncate, references, trigger on table public.store_settings_public from anon, authenticated;

-- Only the SECURITY DEFINER trigger trg_reviews_recompute_stats (owner postgres) needs this.
revoke execute on function public.recompute_product_review_stats(uuid) from public, anon, authenticated;
