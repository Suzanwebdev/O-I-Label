import {
  isStorefrontProductInStock,
  type StorefrontProduct,
} from "@/lib/catalog/storefront-product";

export const RESTOCK_PREF_ANY = "__any__";

/** Notify Me is storefront-visible only when the entire product is sold out. */
export function shouldShowRestockNotify(
  product: Pick<StorefrontProduct, "is_active" | "variants">
): boolean {
  if (product.is_active === false) return false;
  if (!product.variants.length) return false;
  return !isStorefrontProductInStock(product);
}

/** UI "Any" / empty → API null. */
export function preferenceToApiValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === RESTOCK_PREF_ANY) return null;
  if (trimmed.toLowerCase() === "any") return null;
  return trimmed;
}

export function collectProductSizes(product: Pick<StorefrontProduct, "variants">): string[] {
  return Array.from(
    new Set(product.variants.map((v) => v.size).filter((s): s is string => Boolean(s?.trim())))
  );
}

export function collectProductColors(product: Pick<StorefrontProduct, "variants">): string[] {
  return Array.from(
    new Set(product.variants.map((v) => v.color).filter((c): c is string => Boolean(c?.trim())))
  );
}

export function buildRestockSubscribePayload(input: {
  productId: string;
  email: string;
  preferredSize: string;
  preferredColor: string;
  source?: "pdp" | "card" | "quick_view";
}) {
  return {
    productId: input.productId,
    email: input.email.trim(),
    preferredSize: preferenceToApiValue(input.preferredSize),
    preferredColor: preferenceToApiValue(input.preferredColor),
    source: input.source ?? "pdp",
  };
}

export type RestockSubscribeClientResult =
  | { ok: true; alreadySubscribed: boolean; message: string }
  | { ok: false; message: string; productNowAvailable?: boolean };

export function mapRestockSubscribeResponse(opts: {
  status: number;
  body: unknown;
}): RestockSubscribeClientResult {
  const body = (opts.body ?? {}) as {
    success?: boolean;
    alreadySubscribed?: boolean;
    error?: string;
  };

  if (opts.status === 429) {
    return {
      ok: false,
      message: "Too many requests. Please try again shortly.",
    };
  }

  if (opts.status === 409 || body.error?.toLowerCase().includes("currently available")) {
    return {
      ok: false,
      productNowAvailable: true,
      message: "This piece is available again — you can add it to your cart.",
    };
  }

  if (opts.status >= 200 && opts.status < 300 && body.success) {
    if (body.alreadySubscribed) {
      return {
        ok: true,
        alreadySubscribed: true,
        message: "You're already on the list for this piece.",
      };
    }
    return {
      ok: true,
      alreadySubscribed: false,
      message: "You're on the list. We'll email you when this piece is available again.",
    };
  }

  if (typeof body.error === "string" && body.error.trim()) {
    // Prefer API's safe user-facing strings; never surface stack traces / SQL.
    if (/unique|constraint|postgres|supabase|stack/i.test(body.error)) {
      return { ok: false, message: "Could not save your request. Please try again." };
    }
    return { ok: false, message: body.error };
  }

  if (opts.status === 404) {
    return { ok: false, message: "This product is no longer available." };
  }

  return { ok: false, message: "Could not save your request. Please try again." };
}
