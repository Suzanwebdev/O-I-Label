import { shouldTriggerRestockNotification } from "@/lib/restock-notifications/transition";
import { notifyProductRestock } from "@/lib/restock-notifications/send";
import type { SupabaseClient } from "@supabase/supabase-js";

export type VariantStockSnapshot = { id?: string; stock: number };

/** Load all variant stocks for a product (admin restock detection). */
export async function loadProductVariantStockSnapshots(
  service: SupabaseClient,
  productId: string
): Promise<VariantStockSnapshot[]> {
  const { data, error } = await service
    .from("variants")
    .select("id, stock")
    .eq("product_id", productId);

  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    stock: Number(row.stock ?? 0),
  }));
}

/** Reconstruct after-state for a single-variant absolute stock update. */
export function applySingleVariantStockChange(
  beforeVariants: ReadonlyArray<{ id: string; stock: number }>,
  variantId: string,
  newStock: number
): Array<{ id: string; stock: number }> {
  return beforeVariants.map((v) =>
    v.id === variantId ? { id: v.id, stock: newStock } : { id: v.id, stock: v.stock }
  );
}

export type AdminRestockNotifyResult = {
  shouldNotify: boolean;
  notified: boolean;
  error?: string;
};

/**
 * After a successful admin stock write: detect product-level 0→available
 * and notify subscribers. Failures are logged and never thrown to the caller.
 */
export async function maybeNotifyRestockAfterAdminStockChange(opts: {
  productId: string;
  beforeVariants: ReadonlyArray<VariantStockSnapshot>;
  afterVariants: ReadonlyArray<VariantStockSnapshot>;
  notify?: (productId: string) => Promise<unknown>;
}): Promise<AdminRestockNotifyResult> {
  const shouldNotify = shouldTriggerRestockNotification({
    beforeVariants: opts.beforeVariants,
    afterVariants: opts.afterVariants,
  });

  if (!shouldNotify) {
    return { shouldNotify: false, notified: false };
  }

  try {
    const notify = opts.notify ?? notifyProductRestock;
    await notify(opts.productId);
    return { shouldNotify: true, notified: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restock notification failed";
    console.warn(
      `Restock notification failed after admin stock update for product ${opts.productId}:`,
      message
    );
    return { shouldNotify: true, notified: false, error: message };
  }
}
