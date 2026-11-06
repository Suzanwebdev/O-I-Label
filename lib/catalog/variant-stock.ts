import type { Product } from "@/lib/types";

/** Live public availability: product id → (variant id → stock) for products still publicly visible. */
export type LiveAvailability = ReadonlyMap<string, ReadonlyMap<string, number>>;

/**
 * Apply a successful live availability read to cached products. The live read is
 * authoritative: products absent from it (unpublished or deleted) are dropped,
 * variants absent from it are dropped, and stock always comes from the live row.
 */
export function applyLiveAvailability(products: Product[], live: LiveAvailability): Product[] {
  const result: Product[] = [];
  for (const product of products) {
    const liveVariants = live.get(product.id);
    if (!liveVariants) continue;
    result.push({
      ...product,
      variants: product.variants.flatMap((variant) => {
        const stock = liveVariants.get(variant.id);
        return stock === undefined ? [] : [{ ...variant, stock }];
      }),
    });
  }
  return result;
}
