import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CartLine } from "../lib/types.ts";
import {
  buildAddToCartEvent,
  buildBeginCheckoutEvent,
  buildBeginCheckoutSignature,
  buildPurchaseEvent,
  buildViewItemEvent,
  GA4_CURRENCY,
  payloadContainsPii,
  purchaseStorageKey,
  shouldFireDedupedEvent,
  beginCheckoutStorageKey,
  viewItemStorageKey,
} from "../lib/analytics/ga4-events.ts";

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

describe("GA4 view_item payload", () => {
  it("builds view_item with GHS currency and primary variant details", () => {
    const payload = buildViewItemEvent({
      productId: "product-1",
      productName: "Silk Blouse",
      categoryName: "Tops",
      priceGhs: 450,
      size: "M",
      color: "Black",
    });

    assert.equal(payload.currency, GA4_CURRENCY);
    assert.equal(payload.value, 450);
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0]?.item_id, "product-1");
    assert.equal(payload.items[0]?.item_name, "Silk Blouse");
    assert.equal(payload.items[0]?.item_category, "Tops");
    assert.equal(payload.items[0]?.item_variant, "Black · M");
    assert.equal(payload.items[0]?.price, 450);
    assert.equal(payload.items[0]?.quantity, 1);
  });

  it("dedupes view_item by product ID in sessionStorage", () => {
    const storage = new Map<string, string>();
    const session = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    const key = viewItemStorageKey("product-1");
    assert.equal(shouldFireDedupedEvent(session, key), true);
    assert.equal(shouldFireDedupedEvent(session, key), false);
  });
});

describe("GA4 add_to_cart payload", () => {
  it("tracks the quantity added in the current action, not cart total", () => {
    const payload = buildAddToCartEvent(sampleLine, 1);

    assert.equal(payload.currency, GA4_CURRENCY);
    assert.equal(payload.value, 450);
    assert.equal(payload.items[0]?.item_id, "variant-1");
    assert.equal(payload.items[0]?.item_name, "Silk Blouse");
    assert.equal(payload.items[0]?.item_variant, "Black · M");
    assert.equal(payload.items[0]?.price, 450);
    assert.equal(payload.items[0]?.quantity, 1);
  });
});

describe("GA4 begin_checkout payload", () => {
  it("includes all selected lines and subtotal value", () => {
    const lines: CartLine[] = [
      sampleLine,
      {
        ...sampleLine,
        variantId: "variant-2",
        name: "Linen Skirt",
        size: "S",
        color: "Ivory",
        quantity: 1,
        unitPriceGhs: 320,
      },
    ];

    const payload = buildBeginCheckoutEvent(lines, 1220);

    assert.equal(payload.currency, GA4_CURRENCY);
    assert.equal(payload.value, 1220);
    assert.equal(payload.items.length, 2);
    assert.equal(payload.items[0]?.item_id, "variant-1");
    assert.equal(payload.items[0]?.quantity, 2);
    assert.equal(payload.items[1]?.item_id, "variant-2");
    assert.equal(payload.items[1]?.item_variant, "Ivory · S");
  });

  it("dedupes begin_checkout by stable cart signature", () => {
    const signature = buildBeginCheckoutSignature([sampleLine]);
    assert.equal(signature, "variant-1:2");

    const storage = new Map<string, string>();
    const session = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    const key = beginCheckoutStorageKey(signature);
    assert.equal(shouldFireDedupedEvent(session, key), true);
    assert.equal(shouldFireDedupedEvent(session, key), false);
  });
});

describe("GA4 purchase payload", () => {
  it("includes transaction ID, totals, coupon, and line items", () => {
    const payload = buildPurchaseEvent({
      orderNumber: "OI-10042",
      totalGhs: 770,
      taxGhs: 0,
      discountCode: "WELCOME10",
      items: [
        {
          product_id: "product-1",
          variant_id: "variant-1",
          name: "Silk Blouse",
          quantity: 1,
          unit_price_ghs: 450,
          size: "M",
          color: "Black",
        },
        {
          product_id: "product-2",
          variant_id: "variant-2",
          name: "Linen Skirt",
          quantity: 1,
          unit_price_ghs: 320,
          size: "S",
          color: "Ivory",
        },
      ],
    });

    assert.equal(payload.transaction_id, "OI-10042");
    assert.equal(payload.currency, GA4_CURRENCY);
    assert.equal(payload.value, 770);
    assert.equal(payload.tax, 0);
    assert.equal(payload.shipping, 0);
    assert.equal(payload.coupon, "WELCOME10");
    assert.equal(payload.items.length, 2);
    assert.equal(payload.items[0]?.item_id, "variant-1");
    assert.equal(payload.items[0]?.item_variant, "Black · M");
    assert.equal(payload.items[1]?.item_id, "variant-2");
  });

  it("dedupes purchase by order ID in sessionStorage", () => {
    const storage = new Map<string, string>();
    const session = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    const key = purchaseStorageKey("11111111-1111-1111-1111-111111111111");
    assert.equal(shouldFireDedupedEvent(session, key), true);
    assert.equal(shouldFireDedupedEvent(session, key), false);
  });
});

describe("GA4 payload privacy", () => {
  it("does not include PII fields in ecommerce payloads", () => {
    const payloads = [
      buildViewItemEvent({
        productId: "product-1",
        productName: "Silk Blouse",
        categoryName: "Tops",
        priceGhs: 450,
        size: "M",
        color: "Black",
      }),
      buildAddToCartEvent(sampleLine, 1),
      buildBeginCheckoutEvent([sampleLine], 900),
      buildPurchaseEvent({
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
    ];

    for (const payload of payloads) {
      assert.equal(payloadContainsPii(payload), false);
    }
  });

  it("detects forbidden PII keys", () => {
    assert.equal(payloadContainsPii({ email: "shopper@example.com" }), true);
    assert.equal(payloadContainsPii({ phone: "+233000000000" }), true);
    assert.equal(payloadContainsPii({ items: [{ item_name: "Dress" }] }), false);
  });
});
