import { pickProductImageFromJoin } from "@/lib/admin/order-item-image";
import { getSiteUrl } from "@/lib/seo/site";

const PLACEHOLDER = "/file.svg";

/** Absolute URL for product images in email clients. */
export function orderItemImageUrl(storagePathOrUrl: string | null | undefined): string {
  if (!storagePathOrUrl?.trim()) {
    return `${getSiteUrl()}${PLACEHOLDER}`;
  }
  const src = storagePathOrUrl.trim();
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (base) {
    if (src.startsWith("/storage/v1/object/public/")) {
      return `${base}${src}`;
    }
    const path = src.replace(/^\//, "");
    return `${base}/storage/v1/object/public/product-images/${path}`;
  }
  const site = getSiteUrl();
  return src.startsWith("/") ? `${site}${src}` : `${site}/${src}`;
}

export function orderItemImageFromRow(products: unknown): string {
  return orderItemImageUrl(pickProductImageFromJoin(products));
}
