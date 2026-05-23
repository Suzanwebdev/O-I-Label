import type { SupabaseClient } from "@supabase/supabase-js";

export type DiscountKind = "percent" | "fixed" | "free_shipping";

export type DiscountRow = {
  id: string;
  code: string;
  kind: DiscountKind;
  value: number | null;
  min_spend_ghs: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

export type AppliedDiscount = {
  discountId: string;
  code: string;
  kind: DiscountKind;
  discountGhs: number;
  shippingGhs: number;
  label: string;
};

export function normalizeDiscountCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function computeDiscountAmount(
  kind: DiscountKind,
  value: number | null,
  subtotalGhs: number,
  shippingGhs: number
): { discountGhs: number; shippingGhs: number } {
  const subtotal = Math.max(0, subtotalGhs);
  let shipping = Math.max(0, shippingGhs);
  let discount = 0;

  if (kind === "percent" && value != null && value > 0) {
    discount = Math.round(subtotal * (value / 100) * 100) / 100;
    discount = Math.min(discount, subtotal);
  } else if (kind === "fixed" && value != null && value > 0) {
    discount = Math.min(value, subtotal);
  } else if (kind === "free_shipping") {
    discount = shipping;
    shipping = 0;
  }

  discount = Math.round(discount * 100) / 100;
  return { discountGhs: discount, shippingGhs: shipping };
}

function discountLabel(kind: DiscountKind, value: number | null, discountGhs: number): string {
  if (kind === "percent" && value != null) {
    return `${value}% off (−GH₵ ${discountGhs.toFixed(2)})`;
  }
  if (kind === "fixed") {
    return `−GH₵ ${discountGhs.toFixed(2)}`;
  }
  if (kind === "free_shipping") {
    return "Free shipping";
  }
  return `−GH₵ ${discountGhs.toFixed(2)}`;
}

export async function resolveCheckoutDiscount(
  service: SupabaseClient,
  codeRaw: string,
  subtotalGhs: number,
  shippingGhs = 0
): Promise<{ ok: true; applied: AppliedDiscount } | { ok: false; error: string }> {
  const code = normalizeDiscountCode(codeRaw);
  if (!code || code.length < 2) {
    return { ok: false, error: "Enter a promo code" };
  }

  const { data: row, error } = await service
    .from("discounts")
    .select(
      "id, code, kind, value, min_spend_ghs, usage_limit, used_count, starts_at, ends_at, is_active"
    )
    .eq("code", code)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Could not verify promo code" };
  }
  if (!row) {
    return { ok: false, error: "This promo code is not valid" };
  }

  const discount = row as DiscountRow;
  if (!discount.is_active) {
    return { ok: false, error: "This promo code is no longer active" };
  }

  const now = Date.now();
  if (discount.starts_at && new Date(discount.starts_at).getTime() > now) {
    return { ok: false, error: "This promo code is not active yet" };
  }
  if (discount.ends_at && new Date(discount.ends_at).getTime() < now) {
    return { ok: false, error: "This promo code has expired" };
  }

  const minSpend = discount.min_spend_ghs != null ? Number(discount.min_spend_ghs) : null;
  if (minSpend != null && minSpend > 0 && subtotalGhs < minSpend) {
    return {
      ok: false,
      error: `Spend at least GH₵ ${minSpend.toFixed(2)} to use this code`,
    };
  }

  const usageLimit = discount.usage_limit != null ? Number(discount.usage_limit) : null;
  const usedCount = Number(discount.used_count ?? 0);
  if (usageLimit != null && usedCount >= usageLimit) {
    return { ok: false, error: "This promo code has reached its usage limit" };
  }

  const kind = discount.kind as DiscountKind;
  if (kind !== "percent" && kind !== "fixed" && kind !== "free_shipping") {
    return { ok: false, error: "This promo code is not configured correctly" };
  }

  const value = discount.value != null ? Number(discount.value) : null;
  const amounts = computeDiscountAmount(kind, value, subtotalGhs, shippingGhs);

  if (amounts.discountGhs <= 0 && kind === "percent") {
    return { ok: false, error: "This promo code does not apply to your order" };
  }
  if (amounts.discountGhs <= 0 && kind === "fixed") {
    return { ok: false, error: "This promo code does not apply to your order" };
  }

  return {
    ok: true,
    applied: {
      discountId: discount.id,
      code: discount.code,
      kind,
      discountGhs: amounts.discountGhs,
      shippingGhs: amounts.shippingGhs,
      label: discountLabel(kind, value, amounts.discountGhs),
    },
  };
}

export async function incrementDiscountUsage(
  service: SupabaseClient,
  discountId: string
): Promise<void> {
  const { data: row } = await service
    .from("discounts")
    .select("used_count")
    .eq("id", discountId)
    .maybeSingle();
  if (!row) return;
  const next = Number(row.used_count ?? 0) + 1;
  await service.from("discounts").update({ used_count: next }).eq("id", discountId);
}
