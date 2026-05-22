type ProductImageRow = { storage_path: string | null; sort_order: number | null };

/** First sorted product image URL from a Supabase nested `products` join. */
export function pickProductImageFromJoin(products: unknown): string | null {
  const product = Array.isArray(products) ? products[0] : products;
  if (!product || typeof product !== "object") return null;
  const raw = (product as { product_images?: ProductImageRow[] | null }).product_images;
  const images = Array.isArray(raw) ? raw : [];
  const sorted = images
    .filter((img) => typeof img.storage_path === "string" && img.storage_path.length > 0)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  return sorted[0]?.storage_path ?? null;
}
