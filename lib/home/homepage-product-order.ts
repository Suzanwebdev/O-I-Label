/** Key on `home_content.sections` for the homepage Best Sellers product order. */
export const BEST_SELLERS_PRODUCT_ORDER_KEY = "best_sellers_product_order";

/** Parse a saved product-id order from homepage sections JSON. */
export function parseBestSellersProductOrder(sections: Record<string, unknown> | null | undefined): string[] {
  const raw = sections?.[BEST_SELLERS_PRODUCT_ORDER_KEY];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Apply a saved homepage order to a product list.
 * Known ids keep the saved sequence; anything not in the order is appended in `fallback` order.
 */
export function applyHomepageProductOrder<T extends { id: string }>(
  products: T[],
  orderedIds: string[],
  fallback: T[] = products
): T[] {
  if (!orderedIds.length) return [...fallback];

  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered: T[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const product = byId.get(id);
    if (!product || seen.has(product.id)) continue;
    ordered.push(product);
    seen.add(product.id);
  }

  for (const product of fallback) {
    if (seen.has(product.id)) continue;
    ordered.push(product);
    seen.add(product.id);
  }

  return ordered;
}
