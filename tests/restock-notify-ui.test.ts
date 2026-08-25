import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StorefrontProduct } from "../lib/catalog/storefront-product.ts";
import {
  RESTOCK_PREF_ANY,
  buildRestockSubscribePayload,
  mapRestockSubscribeResponse,
  preferenceToApiValue,
  shouldShowRestockNotify,
} from "../lib/restock-notifications/ui.ts";

function storefrontProduct(
  variants: Array<{ in_stock: boolean; size?: string | null; color?: string | null }>,
  opts?: { is_active?: boolean }
): StorefrontProduct {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "satin-midi",
    name: "Satin Midi Dress",
    description: null,
    category_id: null,
    category_name: null,
    is_active: opts?.is_active ?? true,
    badges: [],
    rating: null,
    review_count: null,
    images: [],
    love_it_points: [],
    occasions: [],
    video_urls: [],
    variants: variants.map((v, i) => ({
      id: `v${i}`,
      sku: `SKU-${i}`,
      price_ghs: 100,
      compare_at_ghs: null,
      size: v.size ?? null,
      color: v.color ?? null,
      in_stock: v.in_stock,
    })),
  } as StorefrontProduct;
}

describe("shouldShowRestockNotify", () => {
  it("shows Notify Me when every variant is sold out", () => {
    const product = storefrontProduct([
      { in_stock: false, size: "M", color: "Pink" },
      { in_stock: false, size: "L", color: "Pink" },
      { in_stock: false, size: "M", color: "Black" },
    ]);
    assert.equal(shouldShowRestockNotify(product), true);
  });

  it("does not show Notify Me when one variant is in stock", () => {
    const product = storefrontProduct([
      { in_stock: false, size: "M", color: "Pink" },
      { in_stock: true, size: "L", color: "Pink" },
      { in_stock: false, size: "M", color: "Black" },
    ]);
    assert.equal(shouldShowRestockNotify(product), false);
  });

  it("does not show Notify Me for inactive products", () => {
    const product = storefrontProduct([{ in_stock: false }], { is_active: false });
    assert.equal(shouldShowRestockNotify(product), false);
  });

  it("does not show Notify Me with no variants", () => {
    const product = storefrontProduct([]);
    assert.equal(shouldShowRestockNotify(product), false);
  });
});

describe("restock preference payload", () => {
  it("maps Any / empty to null", () => {
    assert.equal(preferenceToApiValue(RESTOCK_PREF_ANY), null);
    assert.equal(preferenceToApiValue("Any"), null);
    assert.equal(preferenceToApiValue(""), null);
    assert.equal(preferenceToApiValue("M"), "M");
    assert.equal(preferenceToApiValue("Pink"), "Pink");
  });

  it("builds PDP payload with source pdp and null Any prefs", () => {
    const payload = buildRestockSubscribePayload({
      productId: "11111111-1111-4111-8111-111111111111",
      email: "  Guest@Example.com ",
      preferredSize: RESTOCK_PREF_ANY,
      preferredColor: "Pink",
      source: "pdp",
    });
    assert.deepEqual(payload, {
      productId: "11111111-1111-4111-8111-111111111111",
      email: "Guest@Example.com",
      preferredSize: null,
      preferredColor: "Pink",
      source: "pdp",
    });
  });

  it("allows Any size + Any colour", () => {
    const payload = buildRestockSubscribePayload({
      productId: "11111111-1111-4111-8111-111111111111",
      email: "a@b.co",
      preferredSize: "Any",
      preferredColor: RESTOCK_PREF_ANY,
      source: "pdp",
    });
    assert.equal(payload.preferredSize, null);
    assert.equal(payload.preferredColor, null);
    assert.equal(payload.source, "pdp");
  });
});

describe("mapRestockSubscribeResponse", () => {
  it("handles success", () => {
    const mapped = mapRestockSubscribeResponse({
      status: 200,
      body: { success: true, alreadySubscribed: false },
    });
    assert.equal(mapped.ok, true);
    if (mapped.ok) {
      assert.equal(mapped.alreadySubscribed, false);
      assert.match(mapped.message, /on the list/i);
    }
  });

  it("handles alreadySubscribed", () => {
    const mapped = mapRestockSubscribeResponse({
      status: 200,
      body: { success: true, alreadySubscribed: true },
    });
    assert.equal(mapped.ok, true);
    if (mapped.ok) {
      assert.equal(mapped.alreadySubscribed, true);
      assert.match(mapped.message, /already on the list/i);
    }
  });

  it("handles product now available", () => {
    const mapped = mapRestockSubscribeResponse({
      status: 409,
      body: { error: "This product is currently available. You can add it to your cart." },
    });
    assert.equal(mapped.ok, false);
    if (!mapped.ok) {
      assert.equal(mapped.productNowAvailable, true);
      assert.match(mapped.message, /available again/i);
    }
  });

  it("handles rate limiting safely", () => {
    const mapped = mapRestockSubscribeResponse({
      status: 429,
      body: { error: "Too many requests. Please try again shortly." },
    });
    assert.equal(mapped.ok, false);
    if (!mapped.ok) assert.match(mapped.message, /too many requests/i);
  });

  it("does not surface internal database errors", () => {
    const mapped = mapRestockSubscribeResponse({
      status: 500,
      body: { error: "duplicate key value violates unique constraint idx_restock" },
    });
    assert.equal(mapped.ok, false);
    if (!mapped.ok) {
      assert.equal(mapped.message, "Could not save your request. Please try again.");
    }
  });
});
