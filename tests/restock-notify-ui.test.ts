import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("does not show Notify Me when one colour has stock among many sold-out variants", () => {
    const product = storefrontProduct([
      { in_stock: false, size: "S", color: "Black" },
      { in_stock: false, size: "M", color: "Black" },
      { in_stock: true, size: "S", color: "White" },
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

  it("builds card payload with source card", () => {
    const payload = buildRestockSubscribePayload({
      productId: "11111111-1111-4111-8111-111111111111",
      email: "guest@example.com",
      preferredSize: "M",
      preferredColor: RESTOCK_PREF_ANY,
      source: "card",
    });
    assert.equal(payload.source, "card");
    assert.equal(payload.preferredSize, "M");
    assert.equal(payload.preferredColor, null);
  });

  it("defaults source to pdp when omitted", () => {
    const payload = buildRestockSubscribePayload({
      productId: "11111111-1111-4111-8111-111111111111",
      email: "a@b.co",
      preferredSize: RESTOCK_PREF_ANY,
      preferredColor: RESTOCK_PREF_ANY,
    });
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

describe("storefront Notify Me listing surfaces", () => {
  it("wires ProductCard sold-out path to listing CTA + card source dialog", () => {
    const root = process.cwd();
    const card = readFileSync(join(root, "components/store/product-card.tsx"), "utf8");
    const cta = readFileSync(join(root, "components/store/restock-notify-listing-cta.tsx"), "utf8");
    const dialog = readFileSync(join(root, "components/store/restock-notify-dialog.tsx"), "utf8");
    const pdp = readFileSync(join(root, "components/product/product-variant-form.tsx"), "utf8");

    assert.match(card, /RestockNotifyListingCta/);
    assert.match(card, /SoldOutBadge/);
    assert.match(card, /PurchaseActions/);
    assert.doesNotMatch(card, /source=["']pdp["']/);

    assert.match(cta, /shouldShowRestockNotify/);
    assert.match(cta, /Notify Me/);
    assert.match(cta, /RestockNotifyDialog/);
    assert.match(cta, /SoldOutMessage/);
    assert.match(cta, /source/);

    assert.match(dialog, /source = "pdp"/);
    assert.match(dialog, /source,/);

    // PDP keeps its own Notify Me button + dialog without forcing card source.
    assert.match(pdp, /Notify Me When Available/);
    assert.match(pdp, /RestockNotifyDialog/);
    assert.doesNotMatch(pdp, /RestockNotifyListingCta/);
    assert.doesNotMatch(pdp, /source=["']card["']/);
  });

  it("ProductCard consumers and custom listing rows receive Notify Me", () => {
    const root = process.cwd();
    const shop = readFileSync(join(root, "components/shop/shop-catalog.tsx"), "utf8");
    const related = readFileSync(join(root, "components/product/product-you-may-also-like.tsx"), "utf8");
    const best = readFileSync(join(root, "components/home/best-sellers-row.tsx"), "utf8");
    const trending = readFileSync(join(root, "components/home/trending-strip.tsx"), "utf8");
    const quick = readFileSync(join(root, "components/shop/quick-view-modal.tsx"), "utf8");

    assert.match(shop, /ProductCard/);
    assert.match(shop, /Quick view/i);
    assert.match(related, /ProductCard/);

    assert.match(best, /RestockNotifyListingCta/);
    assert.match(best, /PurchaseActions/);
    assert.match(trending, /RestockNotifyListingCta/);
    assert.match(quick, /RestockNotifyDialog/);
    assert.match(quick, /source=["']quick_view["']/);
    assert.match(quick, /SoldOutBadge/);
    assert.match(quick, /PurchaseActions/);
  });

  it("does not touch checkout, payments, or restock server notify paths", () => {
    const root = process.cwd();
    const checkout = readFileSync(join(root, "app/api/checkout/initialize/route.ts"), "utf8");
    const deduct = readFileSync(join(root, "lib/inventory/deduct-order-stock.ts"), "utf8");
    const notify = readFileSync(join(root, "lib/restock-notifications/notify.ts"), "utf8");
    const subscribe = readFileSync(
      join(root, "app/api/restock-notifications/subscribe/route.ts"),
      "utf8"
    );

    assert.doesNotMatch(checkout, /RestockNotifyListingCta|product-card/);
    assert.doesNotMatch(deduct, /RestockNotifyListingCta|product-card/);
    assert.doesNotMatch(notify, /RestockNotifyListingCta|product-card/);
    // Subscribe API already accepts card/quick_view sources — unchanged by this UI phase.
    assert.match(subscribe, /restock|subscribe/i);
  });
});
