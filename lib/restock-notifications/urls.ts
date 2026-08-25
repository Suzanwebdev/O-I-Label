import { absoluteUrl } from "@/lib/seo/site";

/** PDP URL for restock emails — uses configured app base URL. */
export function buildRestockProductUrl(slug: string): string {
  const clean = slug.trim().replace(/^\/+/, "");
  return absoluteUrl(`/product/${clean}`);
}

/** Unsubscribe URL for a restock subscription token. */
export function buildRestockUnsubscribeUrl(unsubscribeToken: string): string {
  const token = unsubscribeToken.trim();
  return absoluteUrl(
    `/api/restock-notifications/unsubscribe?token=${encodeURIComponent(token)}`
  );
}
