import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { CartLine } from "../lib/types.ts";
import {
  buildAddToCartEvent,
  buildBeginCheckoutEvent,
  buildPurchaseEvent,
  buildViewItemEvent,
  GA4_ITEM_BRAND,
  GA4_STORE_AFFILIATION,
  roundGhsAmount,
} from "../lib/analytics/ga4-events.ts";
import {
  GA4_ADMIN_CUSTOM_DIMENSIONS,
  GA4_ECOMMERCE_EVENT_NAMES,
  GA4_ITEM_ID_STRATEGY,
  GA4_RECOMMENDED_CONVERSION_EVENTS,
  validateEcommerceEventForReporting,
} from "../lib/analytics/ga4-reporting.ts";

const sampleLine: CartLine = {
  variantId: "variant-1",
  productId: "product-1",
  productSlug: "silk-blouse",
  name: "Silk Blouse",
  image: "/img.jpg",
  size: "M",
  color: "Black",
  quantity: 2,
  unitPriceGhs: 450,
  selected: true,
};

describe("GA4 reporting amount normalization", () => {
  it("rounds GHS amounts to two decimal places", () => {
    assert.equal(roundGhsAmount(450.555), 450.56);
    assert.equal(roundGhsAmount(0.1 + 0.2), 0.3);
  });

  it("includes item_brand on all ecommerce item payloads", () => {
    const view = buildViewItemEvent({
      productId: "product-1",
      productName: "Silk Blouse",
      categoryName: "Tops",
      priceGhs: 450,
      size: "M",
      color: "Black",
    });
    const cart = buildAddToCartEvent(sampleLine, 1);
    const checkout = buildBeginCheckoutEvent([sampleLine], 900);
    const purchase = buildPurchaseEvent({
      orderNumber: "OI-10042",
      totalGhs: 900,
      items: [
        {
          product_id: "product-1",
          variant_id: "variant-1",
          name: "Silk Blouse",
          quantity: 2,
          unit_price_ghs: 450,
        },
      ],
    });

    for (const payload of [view, cart, checkout, purchase]) {
      assert.equal(payload.items[0]?.item_brand, GA4_ITEM_BRAND);
    }
  });

  it("includes affiliation on purchase for Monetization reports", () => {
    const purchase = buildPurchaseEvent({
      orderNumber: "OI-10042",
      totalGhs: 900,
      items: [
        {
          product_id: "product-1",
          variant_id: "variant-1",
          name: "Silk Blouse",
          quantity: 1,
          unit_price_ghs: 900,
        },
      ],
    });

    assert.equal(purchase.affiliation, GA4_STORE_AFFILIATION);
  });
});

describe("GA4 reporting validation", () => {
  it("validates all implemented ecommerce event payloads", () => {
    const payloads = {
      view_item: buildViewItemEvent({
        productId: "product-1",
        productName: "Silk Blouse",
        categoryName: "Tops",
        priceGhs: 450,
        size: "M",
        color: "Black",
      }),
      add_to_cart: buildAddToCartEvent(sampleLine, 1),
      begin_checkout: buildBeginCheckoutEvent([sampleLine], 900),
      purchase: buildPurchaseEvent({
        orderNumber: "OI-10042",
        totalGhs: 900,
        items: [
          {
            product_id: "product-1",
            variant_id: "variant-1",
            name: "Silk Blouse",
            quantity: 2,
            unit_price_ghs: 450,
            size: "M",
            color: "Black",
          },
        ],
      }),
    };

    for (const eventName of GA4_ECOMMERCE_EVENT_NAMES) {
      const result = validateEcommerceEventForReporting(eventName, payloads[eventName]);
      assert.equal(result.valid, true, `${eventName}: ${result.issues.join(", ")}`);
    }
  });

  it("rejects purchase payloads with PII", () => {
    const result = validateEcommerceEventForReporting("purchase", {
      transaction_id: "OI-10042",
      value: 900,
      currency: "GHS",
      tax: 0,
      shipping: 0,
      email: "shopper@example.com",
      items: [{ item_id: "v1", item_name: "Dress", price: 900, quantity: 1 }],
    });

    assert.equal(result.valid, false);
    assert.match(result.issues.join(" "), /PII/i);
  });

  it("rejects purchase without transaction_id", () => {
    const result = validateEcommerceEventForReporting("purchase", {
      value: 900,
      currency: "GHS",
      tax: 0,
      shipping: 0,
      items: [{ item_id: "v1", item_name: "Dress", price: 900, quantity: 1 }],
    });

    assert.equal(result.valid, false);
    assert.match(result.issues.join(" "), /transaction_id/i);
  });

  it("documents item_id strategy for reporting comparisons", () => {
    assert.equal(GA4_ITEM_ID_STRATEGY.view_item, "product_id");
    assert.equal(GA4_ITEM_ID_STRATEGY.add_to_cart, "variant_id");
    assert.equal(GA4_ITEM_ID_STRATEGY.purchase, "variant_id");
  });

  it("exposes GA4 admin configuration registry for manual setup", () => {
    assert.ok(GA4_RECOMMENDED_CONVERSION_EVENTS.includes("purchase"));
    assert.ok(GA4_ADMIN_CUSTOM_DIMENSIONS.some((d) => d.parameterName === "transaction_id"));
    assert.ok(GA4_ADMIN_CUSTOM_DIMENSIONS.some((d) => d.parameterName === "item_brand"));
  });
});

describe("GA4 storefront scope", () => {
  it("mounts GoogleAnalytics only in the storefront layout", () => {
    const storeLayout = readFileSync("app/(store)/layout.tsx", "utf8");
    const rootLayout = readFileSync("app/layout.tsx", "utf8");
    const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");

    assert.match(storeLayout, /StoreGoogleAnalytics/);
    assert.doesNotMatch(rootLayout, /StoreGoogleAnalytics|GoogleAnalytics/);
    assert.doesNotMatch(adminLayout, /StoreGoogleAnalytics|GoogleAnalytics|trackPurchase|trackAddToCart/);
  });
});
