/** Restock / "Notify Me When Available" — Phase 1 subscription helpers. */

export const RESTOCK_SUBSCRIPTION_SOURCES = ["pdp", "card", "quick_view"] as const;
export type RestockSubscriptionSource = (typeof RESTOCK_SUBSCRIPTION_SOURCES)[number];

export type RestockSubscriptionStatus =
  | "active"
  | "notified"
  | "unsubscribed"
  | "cancelled";

export type RestockProductVariantRow = {
  id: string;
  size: string | null;
  color: string | null;
  stock: number;
};

export type RestockProductRow = {
  id: string;
  is_active: boolean;
  variants: RestockProductVariantRow[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeRestockEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidRestockEmail(email: string): boolean {
  const trimmed = email.trim();
  return Boolean(trimmed) && EMAIL_RE.test(trimmed);
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function isValidProductId(productId: string): boolean {
  return isUuid(productId);
}

/**
 * Product is completely sold out when it has at least one variant and
 * every variant has stock <= 0.
 */
export function isProductCompletelySoldOut(
  variants: ReadonlyArray<Pick<RestockProductVariantRow, "stock">>
): boolean {
  if (!variants.length) return false;
  return variants.every((v) => Number(v.stock ?? 0) <= 0);
}

export function collectVariantColors(
  variants: ReadonlyArray<Pick<RestockProductVariantRow, "color">>
): string[] {
  const out = new Set<string>();
  for (const v of variants) {
    const color = typeof v.color === "string" ? v.color.trim() : "";
    if (color) out.add(color);
  }
  return [...out];
}

export function collectVariantSizes(
  variants: ReadonlyArray<Pick<RestockProductVariantRow, "size">>
): string[] {
  const out = new Set<string>();
  for (const v of variants) {
    const size = typeof v.size === "string" ? v.size.trim() : "";
    if (size) out.add(size);
  }
  return [...out];
}

/** NULL means "Any". Empty / "any" (case-insensitive) also map to Any. */
export function normalizePreferenceAny(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return { error: "Invalid preference" };
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "any") return null;
  return trimmed;
}

export function validatePreferredColor(
  preferred: string | null,
  variants: ReadonlyArray<Pick<RestockProductVariantRow, "color">>
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (preferred === null) return { ok: true, value: null };
  const allowed = collectVariantColors(variants);
  if (!allowed.includes(preferred)) {
    return { ok: false, error: "That colour is not available for this product" };
  }
  return { ok: true, value: preferred };
}

export function validatePreferredSize(
  preferred: string | null,
  variants: ReadonlyArray<Pick<RestockProductVariantRow, "size">>
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (preferred === null) return { ok: true, value: null };
  const allowed = collectVariantSizes(variants);
  if (!allowed.includes(preferred)) {
    return { ok: false, error: "That size is not available for this product" };
  }
  return { ok: true, value: preferred };
}

export function normalizeRestockSource(value: unknown): RestockSubscriptionSource {
  if (typeof value !== "string") return "pdp";
  const trimmed = value.trim().slice(0, 32);
  if ((RESTOCK_SUBSCRIPTION_SOURCES as readonly string[]).includes(trimmed)) {
    return trimmed as RestockSubscriptionSource;
  }
  return "pdp";
}
