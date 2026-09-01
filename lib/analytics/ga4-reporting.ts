import {
  GA4_CURRENCY,
  GA4_ITEM_BRAND,
  GA4_PII_FIELD_NAMES,
  GA4_STORE_AFFILIATION,
  payloadContainsPii,
  type Ga4Item,
} from "@/lib/analytics/ga4-events";

/** Recommended GA4 ecommerce events implemented on the storefront. */
export const GA4_ECOMMERCE_EVENT_NAMES = [
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "purchase",
] as const;

export type Ga4EcommerceEventName = (typeof GA4_ECOMMERCE_EVENT_NAMES)[number];

/**
 * Mark these as conversions in GA4 Admin → Events (manual UI step).
 * purchase is the primary revenue conversion; begin_checkout is optional funnel signal.
 */
export const GA4_RECOMMENDED_CONVERSION_EVENTS = ["purchase", "begin_checkout"] as const;

/**
 * Register these event-scoped custom dimensions in GA4 Admin when building explorations.
 * Standard item params (item_id, item_name, item_category, item_variant) are auto-collected.
 */
export const GA4_ADMIN_CUSTOM_DIMENSIONS = [
  { parameterName: "transaction_id", scope: "EVENT", description: "Order number (e.g. OI-10042)" },
  { parameterName: "coupon", scope: "EVENT", description: "Promo code applied at checkout" },
  { parameterName: "affiliation", scope: "EVENT", description: "Store affiliation on purchase" },
  { parameterName: "item_brand", scope: "ITEM", description: "Product brand (O & I Label)" },
  { parameterName: "item_variant", scope: "ITEM", description: "Size/color variant label" },
  { parameterName: "item_category", scope: "ITEM", description: "Primary product category" },
] as const;

/**
 * view_item uses product ID; cart/checkout/purchase use variant ID for SKU-level funnel accuracy.
 * This is intentional — document when comparing PDP views to cart adds in GA4 explorations.
 */
export const GA4_ITEM_ID_STRATEGY = {
  view_item: "product_id",
  add_to_cart: "variant_id",
  begin_checkout: "variant_id",
  purchase: "variant_id",
} as const satisfies Record<Ga4EcommerceEventName, string>;

export type ReportingValidationResult = {
  valid: boolean;
  issues: string[];
};

export { roundGhsAmount } from "@/lib/analytics/ga4-events";

function validateGa4Item(item: unknown, index: number, issues: string[]): void {
  if (item == null || typeof item !== "object") {
    issues.push(`items[${index}] must be an object`);
    return;
  }

  const row = item as Ga4Item;
  if (!row.item_id?.trim()) issues.push(`items[${index}].item_id is required`);
  if (!row.item_name?.trim()) issues.push(`items[${index}].item_name is required`);
  if (typeof row.price !== "number" || row.price < 0) {
    issues.push(`items[${index}].price must be a non-negative number`);
  }
  if (typeof row.quantity !== "number" || row.quantity <= 0 || !Number.isInteger(row.quantity)) {
    issues.push(`items[${index}].quantity must be a positive integer`);
  }
  if (row.item_brand !== undefined && row.item_brand !== GA4_ITEM_BRAND) {
    issues.push(`items[${index}].item_brand must be "${GA4_ITEM_BRAND}" when set`);
  }
}

export function validateEcommerceEventForReporting(
  eventName: string,
  payload: unknown
): ReportingValidationResult {
  const issues: string[] = [];

  if (!(GA4_ECOMMERCE_EVENT_NAMES as readonly string[]).includes(eventName)) {
    issues.push(`Unknown ecommerce event: ${eventName}`);
    return { valid: false, issues };
  }

  if (payload == null || typeof payload !== "object") {
    issues.push("Payload must be an object");
    return { valid: false, issues };
  }

  const params = payload as Record<string, unknown>;

  if (params.currency !== GA4_CURRENCY) {
    issues.push(`currency must be ${GA4_CURRENCY}`);
  }

  if (payloadContainsPii(payload)) {
    issues.push(`Payload contains forbidden PII field (one of: ${GA4_PII_FIELD_NAMES.join(", ")})`);
  }

  if (typeof params.value !== "number" || params.value < 0) {
    issues.push("value must be a non-negative number");
  }

  if (!Array.isArray(params.items) || params.items.length === 0) {
    issues.push("items must be a non-empty array");
  } else {
    params.items.forEach((item, index) => validateGa4Item(item, index, issues));

    if (eventName === "view_item" && params.items.length !== 1) {
      issues.push("view_item must include exactly one item");
    }
  }

  if (eventName === "purchase") {
    if (typeof params.transaction_id !== "string" || !params.transaction_id.trim()) {
      issues.push("purchase requires a non-empty transaction_id");
    }
    if (typeof params.tax !== "number" || params.tax < 0) {
      issues.push("purchase tax must be a non-negative number");
    }
    if (typeof params.shipping !== "number" || params.shipping < 0) {
      issues.push("purchase shipping must be a non-negative number");
    }
    if (params.affiliation !== undefined && params.affiliation !== GA4_STORE_AFFILIATION) {
      issues.push(`purchase affiliation must be "${GA4_STORE_AFFILIATION}" when set`);
    }
  }

  return { valid: issues.length === 0, issues };
}
