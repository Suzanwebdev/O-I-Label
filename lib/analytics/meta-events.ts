import type { Ga4PurchaseParams } from "@/lib/analytics/ga4-events";
import { GA4_PII_FIELD_NAMES, payloadContainsPii, roundGhsAmount } from "@/lib/analytics/ga4-events";
import type { CartLine } from "@/lib/types";

export const META_CURRENCY = "GHS" as const;

export const META_VIEW_CONTENT_KEY_PREFIX = "meta:view_content:";
export const META_INITIATE_CHECKOUT_KEY_PREFIX = "meta:initiate_checkout:";
export const META_PURCHASE_KEY_PREFIX = "meta:purchase:";

export type MetaContentItem = {
  id: string;
  quantity: number;
  item_price?: number;
};

export type MetaViewContentParams = {
  content_ids: string[];
  content_name: string;
  content_type: "product";
  content_category?: string;
  contents: MetaContentItem[];
  value: number;
  currency: typeof META_CURRENCY;
};

export type MetaAddToCartParams = {
  content_ids: string[];
  content_name: string;
  content_type: "product";
  contents: MetaContentItem[];
  value: number;
  currency: typeof META_CURRENCY;
};

export type MetaInitiateCheckoutParams = {
  content_ids: string[];
  content_type: "product";
  contents: MetaContentItem[];
  value: number;
  currency: typeof META_CURRENCY;
  num_items: number;
};

export type MetaPurchaseParams = {
  value: number;
  currency: typeof META_CURRENCY;
  content_ids: string[];
  content_type: "product";
  contents: MetaContentItem[];
  num_items: number;
};

export function viewContentStorageKey(productId: string): string {
  return `${META_VIEW_CONTENT_KEY_PREFIX}${productId}`;
}

export function initiateCheckoutStorageKey(signature: string): string {
  return `${META_INITIATE_CHECKOUT_KEY_PREFIX}${signature}`;
}

export function metaPurchaseStorageKey(orderId: string): string {
  return `${META_PURCHASE_KEY_PREFIX}${orderId}`;
}

export function buildMetaViewContentEvent(input: {
  productId: string;
  productName: string;
  categoryName?: string;
  priceGhs: number;
}): MetaViewContentParams {
  const value = roundGhsAmount(input.priceGhs);
  const params: MetaViewContentParams = {
    content_ids: [input.productId],
    content_name: input.productName,
    content_type: "product",
    contents: [{ id: input.productId, quantity: 1 }],
    value,
    currency: META_CURRENCY,
  };
  if (input.categoryName) params.content_category = input.categoryName;
  return params;
}

export function buildMetaAddToCartEvent(line: CartLine, quantityAdded: number): MetaAddToCartParams {
  const itemPrice = roundGhsAmount(line.unitPriceGhs);
  return {
    content_ids: [line.variantId],
    content_name: line.name,
    content_type: "product",
    contents: [{ id: line.variantId, quantity: quantityAdded, item_price: itemPrice }],
    value: roundGhsAmount(itemPrice * quantityAdded),
    currency: META_CURRENCY,
  };
}

export function buildMetaInitiateCheckoutEvent(
  lines: CartLine[],
  subtotalGhs: number
): MetaInitiateCheckoutParams {
  return {
    content_ids: lines.map((line) => line.variantId),
    content_type: "product",
    contents: lines.map((line) => ({
      id: line.variantId,
      quantity: line.quantity,
      item_price: roundGhsAmount(line.unitPriceGhs),
    })),
    value: roundGhsAmount(subtotalGhs),
    currency: META_CURRENCY,
    num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export function buildMetaPurchaseEvent(purchase: Ga4PurchaseParams): MetaPurchaseParams {
  return {
    value: roundGhsAmount(purchase.value),
    currency: META_CURRENCY,
    content_ids: purchase.items.map((item) => item.item_id),
    content_type: "product",
    contents: purchase.items.map((item) => ({
      id: item.item_id,
      quantity: item.quantity,
      item_price: item.price,
    })),
    num_items: purchase.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export function metaPayloadContainsPii(payload: unknown): boolean {
  return payloadContainsPii(payload);
}

export { GA4_PII_FIELD_NAMES as META_PII_FIELD_NAMES };
