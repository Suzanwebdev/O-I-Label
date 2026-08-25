import { isProductCompletelySoldOut } from "@/lib/restock-notifications/helpers";

type StockVariant = { stock?: number | null };

/** Product has at least one variant with stock > 0. Empty product → false. */
export function isProductAvailableFromStocks(
  variants: ReadonlyArray<StockVariant>
): boolean {
  if (!variants.length) return false;
  return variants.some((v) => Number(v.stock ?? 0) > 0);
}

/**
 * Product-level restock transition detection.
 *
 * Returns true only when the product moves from completely sold out
 * (every variant stock <= 0, and at least one variant exists)
 * to available (at least one variant stock > 0).
 *
 * Preference size/colour are irrelevant — notification scope is product-level.
 * Does not send emails or touch inventory/checkout.
 */
export function shouldTriggerRestockNotification(input: {
  beforeVariants: ReadonlyArray<StockVariant>;
  afterVariants: ReadonlyArray<StockVariant>;
}): boolean {
  const wasSoldOut = isProductCompletelySoldOut(input.beforeVariants);
  if (!wasSoldOut) return false;
  return isProductAvailableFromStocks(input.afterVariants);
}
