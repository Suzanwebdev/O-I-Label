import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductActivityResult =
  | { ok: true; inactiveProductIds: string[] }
  | { ok: false; error: string };

/**
 * Authoritative publication check for new checkouts. Products missing from the
 * database are reported as inactive. Only used before an order is created; it
 * never touches existing orders or payments.
 */
export async function findInactiveProducts(
  service: SupabaseClient,
  productIds: string[]
): Promise<ProductActivityResult> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return { ok: true, inactiveProductIds: [] };

  const { data, error } = await service.from("products").select("id, is_active").in("id", ids);
  if (error) return { ok: false, error: error.message };

  const active = new Set(
    ((data ?? []) as { id: string; is_active: boolean | null }[])
      .filter((row) => row.is_active === true)
      .map((row) => String(row.id))
  );
  return { ok: true, inactiveProductIds: ids.filter((id) => !active.has(id)) };
}
