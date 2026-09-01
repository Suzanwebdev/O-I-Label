import { formatPackingSlipVariantLine } from "@/lib/admin/order-item-variant";
import type { CartLine } from "@/lib/types";

export const GA4_CURRENCY = "GHS" as const;

/** Store name sent on purchase for Monetization / ecommerce reports. */
export const GA4_STORE_AFFILIATION = "O & I Label";

/** Item brand for GA4 product performance reports (single-brand storefront). */
export const GA4_ITEM_BRAND = "O & I Label";

export function roundGhsAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export const GA4_VIEW_ITEM_KEY_PREFIX = "ga4:view_item:";
export const GA4_BEGIN_CHECKOUT_KEY_PREFIX = "ga4:begin_checkout:";
export const GA4_PURCHASE_KEY_PREFIX = "ga4:purchase:";

export type Ga4Item = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
};

export type Ga4ViewItemParams = {
  currency: typeof GA4_CURRENCY;
  value: number;
  items: Ga4Item[];
};

export type Ga4AddToCartParams = {
  currency: typeof GA4_CURRENCY;
  value: number;
  items: Ga4Item[];
};

export type Ga4BeginCheckoutParams = {
  currency: typeof GA4_CURRENCY;
  value: number;
  items: Ga4Item[];
};

export type Ga4PurchaseItemInput = {
  product_id: string | null;
  variant_id: string | null;
  name: string;
  quantity: number;
  unit_price_ghs: number;
  size?: string | null;
  color?: string | null;
};

export type Ga4PurchaseParams = {
  transaction_id: string;
  value: number;
  currency: typeof GA4_CURRENCY;
  affiliation?: string;
  tax: number;
  shipping: number;
  coupon?: string;
  items: Ga4Item[];
};

export const GA4_PII_FIELD_NAMES = [
  "email",
  "phone",
  "phone_number",
  "first_name",
  "last_name",
  "firstName",
  "lastName",
  "address",
  "city",
  "region",
  "name",
  "customer_name",
  "momo",
] as const;

export function formatGa4ItemVariant(
  size?: string | null,
  color?: string | null
): string | undefined {
  const variant = formatPackingSlipVariantLine({ size, color });
  return variant ?? undefined;
}

export function buildGa4ItemFromCartLine(line: CartLine, quantity?: number): Ga4Item {
  const qty = quantity ?? line.quantity;
  return {
    item_id: line.variantId,
    item_name: line.name,
    item_brand: GA4_ITEM_BRAND,
    item_variant: formatGa4ItemVariant(line.size, line.color),
    price: roundGhsAmount(line.unitPriceGhs),
    quantity: qty,
  };
}

export function buildViewItemEvent(input: {
  productId: string;
  productName: string;
  categoryName?: string;
  priceGhs: number;
  size?: string | null;
  color?: string | null;
}): Ga4ViewItemParams {
  const price = roundGhsAmount(input.priceGhs);
  const item: Ga4Item = {
    item_id: input.productId,
    item_name: input.productName,
    item_brand: GA4_ITEM_BRAND,
    price,
    quantity: 1,
  };
  if (input.categoryName) item.item_category = input.categoryName;
  const variant = formatGa4ItemVariant(input.size, input.color);
  if (variant) item.item_variant = variant;

  return {
    currency: GA4_CURRENCY,
    value: price,
    items: [item],
  };
}

export function buildAddToCartEvent(line: CartLine, quantityAdded: number): Ga4AddToCartParams {
  const item = buildGa4ItemFromCartLine(line, quantityAdded);
  return {
    currency: GA4_CURRENCY,
    value: roundGhsAmount(item.price * item.quantity),
    items: [item],
  };
}

export function buildBeginCheckoutEvent(
  lines: CartLine[],
  subtotalGhs: number
): Ga4BeginCheckoutParams {
  return {
    currency: GA4_CURRENCY,
    value: roundGhsAmount(subtotalGhs),
    items: lines.map((line) => buildGa4ItemFromCartLine(line)),
  };
}

export function buildPurchaseEvent(input: {
  orderNumber: string;
  totalGhs: number;
  taxGhs?: number | null;
  discountCode?: string | null;
  items: Ga4PurchaseItemInput[];
}): Ga4PurchaseParams {
  const gaItems: Ga4Item[] = input.items.map((row) => {
    const item: Ga4Item = {
      item_id: row.variant_id ?? row.product_id ?? "unknown",
      item_name: row.name,
      item_brand: GA4_ITEM_BRAND,
      price: roundGhsAmount(row.unit_price_ghs),
      quantity: row.quantity,
    };
    const variant = formatGa4ItemVariant(row.size, row.color);
    if (variant) item.item_variant = variant;
    return item;
  });

  const params: Ga4PurchaseParams = {
    transaction_id: input.orderNumber,
    value: roundGhsAmount(input.totalGhs),
    currency: GA4_CURRENCY,
    affiliation: GA4_STORE_AFFILIATION,
    tax: roundGhsAmount(Number(input.taxGhs ?? 0)),
    shipping: 0,
    items: gaItems,
  };

  const coupon = input.discountCode?.trim();
  if (coupon) params.coupon = coupon;

  return params;
}

export function viewItemStorageKey(productId: string): string {
  return `${GA4_VIEW_ITEM_KEY_PREFIX}${productId}`;
}

export function beginCheckoutStorageKey(signature: string): string {
  return `${GA4_BEGIN_CHECKOUT_KEY_PREFIX}${signature}`;
}

export function purchaseStorageKey(orderId: string): string {
  return `${GA4_PURCHASE_KEY_PREFIX}${orderId}`;
}

export function buildBeginCheckoutSignature(lines: CartLine[]): string {
  return [...lines]
    .sort((a, b) => a.variantId.localeCompare(b.variantId))
    .map((line) => `${line.variantId}:${line.quantity}`)
    .join("|");
}

export function shouldFireDedupedEvent(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  key: string
): boolean {
  if (!storage) return false;
  if (storage.getItem(key)) return false;
  storage.setItem(key, "1");
  return true;
}

function collectPayloadKeys(value: unknown, keys: Set<string>): void {
  if (value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const entry of value) collectPayloadKeys(entry, keys);
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key.toLowerCase());
    collectPayloadKeys(nested, keys);
  }
}

export function payloadContainsPii(payload: unknown): boolean {
  const keys = new Set<string>();
  collectPayloadKeys(payload, keys);
  return GA4_PII_FIELD_NAMES.some((field) => keys.has(field.toLowerCase()));
}
