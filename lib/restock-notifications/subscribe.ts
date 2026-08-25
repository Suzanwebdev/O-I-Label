import { randomUUID } from "node:crypto";
import {
  isProductCompletelySoldOut,
  isUuid,
  isValidProductId,
  isValidRestockEmail,
  normalizePreferenceAny,
  normalizeRestockEmail,
  normalizeRestockSource,
  validatePreferredColor,
  validatePreferredSize,
  type RestockProductRow,
  type RestockSubscriptionSource,
} from "@/lib/restock-notifications/helpers";

export type RestockSubscribeInput = {
  productId: unknown;
  email: unknown;
  preferredColor?: unknown;
  preferredSize?: unknown;
  source?: unknown;
  customerId?: string | null;
};

export type RestockSubscribeSuccess = {
  ok: true;
  success: true;
  alreadySubscribed: boolean;
};

export type RestockSubscribeFailure = {
  ok: false;
  status: number;
  error: string;
  code?:
    | "invalid_email"
    | "invalid_product"
    | "product_unavailable"
    | "product_available"
    | "invalid_preference"
    | "server_error";
};

export type RestockSubscribeResult = RestockSubscribeSuccess | RestockSubscribeFailure;

export type RestockSubscriptionStore = {
  findActiveProduct: (productId: string) => Promise<RestockProductRow | null>;
  findActiveSubscription: (opts: {
    emailNormalized: string;
    productId: string;
    preferredColor: string | null;
    preferredSize: string | null;
  }) => Promise<{ id: string } | null>;
  insertSubscription: (row: {
    productId: string;
    emailNormalized: string;
    emailRaw: string;
    customerId: string | null;
    preferredColor: string | null;
    preferredSize: string | null;
    source: RestockSubscriptionSource;
    unsubscribeToken: string;
  }) => Promise<{ ok: true } | { ok: false; duplicate: boolean; error?: string }>;
};

export async function subscribeToRestock(
  input: RestockSubscribeInput,
  store: RestockSubscriptionStore
): Promise<RestockSubscribeResult> {
  const emailRaw = typeof input.email === "string" ? input.email.trim() : "";
  if (!isValidRestockEmail(emailRaw)) {
    return {
      ok: false,
      status: 400,
      error: "Valid email is required",
      code: "invalid_email",
    };
  }

  const productId =
    typeof input.productId === "string" ? input.productId.trim() : "";
  if (!isValidProductId(productId)) {
    return {
      ok: false,
      status: 404,
      error: "Product not found",
      code: "invalid_product",
    };
  }

  const colorNorm = normalizePreferenceAny(input.preferredColor);
  if (typeof colorNorm === "object" && colorNorm && "error" in colorNorm) {
    return {
      ok: false,
      status: 400,
      error: colorNorm.error,
      code: "invalid_preference",
    };
  }

  const sizeNorm = normalizePreferenceAny(input.preferredSize);
  if (typeof sizeNorm === "object" && sizeNorm && "error" in sizeNorm) {
    return {
      ok: false,
      status: 400,
      error: sizeNorm.error,
      code: "invalid_preference",
    };
  }

  const product = await store.findActiveProduct(productId);
  if (!product || !product.is_active) {
    return {
      ok: false,
      status: 404,
      error: "Product not found",
      code: "invalid_product",
    };
  }

  if (!isProductCompletelySoldOut(product.variants)) {
    return {
      ok: false,
      status: 409,
      error: "This product is currently available. You can add it to your cart.",
      code: "product_available",
    };
  }

  const colorCheck = validatePreferredColor(colorNorm, product.variants);
  if (!colorCheck.ok) {
    return {
      ok: false,
      status: 400,
      error: colorCheck.error,
      code: "invalid_preference",
    };
  }

  const sizeCheck = validatePreferredSize(sizeNorm, product.variants);
  if (!sizeCheck.ok) {
    return {
      ok: false,
      status: 400,
      error: sizeCheck.error,
      code: "invalid_preference",
    };
  }

  const emailNormalized = normalizeRestockEmail(emailRaw);
  const source = normalizeRestockSource(input.source);
  const customerId =
    typeof input.customerId === "string" && isUuid(input.customerId)
      ? input.customerId
      : null;

  const existing = await store.findActiveSubscription({
    emailNormalized,
    productId,
    preferredColor: colorCheck.value,
    preferredSize: sizeCheck.value,
  });

  if (existing) {
    return { ok: true, success: true, alreadySubscribed: true };
  }

  const inserted = await store.insertSubscription({
    productId,
    emailNormalized,
    emailRaw,
    customerId,
    preferredColor: colorCheck.value,
    preferredSize: sizeCheck.value,
    source,
    unsubscribeToken: randomUUID(),
  });

  if (!inserted.ok) {
    if (inserted.duplicate) {
      return { ok: true, success: true, alreadySubscribed: true };
    }
    return {
      ok: false,
      status: 500,
      error: "Could not save your notification request. Please try again.",
      code: "server_error",
    };
  }

  return { ok: true, success: true, alreadySubscribed: false };
}
