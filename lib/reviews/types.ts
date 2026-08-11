export const REVIEW_STATUSES = ["pending", "published", "rejected", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_MAX_PHOTOS = 5;
export const REVIEW_MAX_BODY = 2000;
export const REVIEW_MAX_TITLE = 120;
export const REVIEW_MAX_DISPLAY_NAME = 60;
export const REVIEW_MAX_BYTES = 5 * 1024 * 1024;
export const REVIEW_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type ReviewMediaPublic = {
  id: string;
  public_url: string;
  sort_order: number;
};

export type ReviewPublic = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  display_name: string;
  verified_purchase: boolean;
  purchased_color: string | null;
  purchased_size: string | null;
  created_at: string;
  published_at: string | null;
  media: ReviewMediaPublic[];
};

export type ReviewAggregates = {
  average: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type EligibleReviewItem = {
  order_id: string;
  order_number: string;
  order_item_id: string;
  product_id: string;
  product_name: string;
  product_slug: string | null;
  purchased_color: string | null;
  purchased_size: string | null;
  purchased_variant_id: string | null;
  paid_at: string | null;
  already_reviewed: boolean;
  existing_review_id: string | null;
  existing_review_status: ReviewStatus | null;
};

export function formatPurchasedVariantLine(
  color: string | null | undefined,
  size: string | null | undefined
): string | null {
  const c = typeof color === "string" ? color.trim() : "";
  const s = typeof size === "string" ? size.trim() : "";
  if (c && s) return `${c} · ${s}`;
  if (c) return c;
  if (s) return s;
  return null;
}

export function sanitizeDisplayName(raw: string | null | undefined, fallback: string): string {
  const cleaned = (raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, REVIEW_MAX_DISPLAY_NAME);
  if (!cleaned) return fallback;
  // Never allow email-looking public names
  if (cleaned.includes("@")) return fallback;
  return cleaned;
}

export function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}
