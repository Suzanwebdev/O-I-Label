import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CartLine } from "../lib/types.ts";
import { shouldFireDedupedEvent } from "../lib/analytics/ga4-events.ts";
import {
  buildMetaAddToCartEvent,
  buildMetaInitiateCheckoutEvent,
  buildMetaPurchaseEvent,
  buildMetaViewContentEvent,
  initiateCheckoutStorageKey,
  metaPayloadContainsPii,
  metaPurchaseStorageKey,
  META_CURRENCY,
  viewContentStorageKey,
} from "../lib/analytics/meta-events.ts";
import { buildPurchaseEvent } from "../lib/analytics/ga4-events.ts";

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

describe("Meta ViewContent payload", () => {
  it("builds ViewContent with GHS currency and product ID", () => {
    const payload = buildMetaViewContentEvent({
      productId: "product-1",
      productName: "Silk Blouse",
      categoryName: "Tops",
      priceGhs: 450,
    });

    assert.equal(payload.currency, META_CURRENCY);
    assert.equal(payload.content_type, "product");
    assert.deepEqual(payload.content_ids, ["product-1"]);
    assert.equal(payload.content_name, "Silk Blouse");
    assert.equal(payload.content_category, "Tops");
    assert.deepEqual(payload.contents, [{ id: "product-1", quantity: 1 }]);
    assert.equal(payload.value, 450);
  });

  it("dedupes ViewContent by product ID", () => {
    const storage = new Map<string, string>();
    const session = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    const key = viewContentStorageKey("product-1");
    assert.equal(shouldFireDedupedEvent(session, key), true);
    assert.equal(shouldFireDedupedEvent(session, key), false);
  });
});

describe("Meta AddToCart payload", () => {
  it("uses variant ID and action quantity", () => {
    const payload = buildMetaAddToCartEvent(sampleLine, 1);

    assert.equal(payload.currency, META_CURRENCY);
    assert.deepEqual(payload.content_ids, ["variant-1"]);
    assert.equal(payload.content_name, "Silk Blouse");
    assert.equal(payload.contents[0]?.id, "variant-1");
    assert.equal(payload.contents[0]?.quantity, 1);
    assert.equal(payload.contents[0]?.item_price, 450);
    assert.equal(payload.value, 450);
  });
});

describe("Meta InitiateCheckout payload", () => {
  it("includes all lines and num_items", () => {
    const lines: CartLine[] = [
      sampleLine,
      {
        ...sampleLine,
        variantId: "variant-2",
        name: "Linen Skirt",
        quantity: 1,
        unitPriceGhs: 320,
      },
    ];

    const payload = buildMetaInitiateCheckoutEvent(lines, 1220);

    assert.equal(payload.currency, META_CURRENCY);
    assert.equal(payload.value, 1220);
    assert.equal(payload.num_items, 3);
    assert.deepEqual(payload.content_ids, ["variant-1", "variant-2"]);
    assert.equal(payload.contents[0]?.item_price, 450);
  });

  it("dedupes InitiateCheckout by cart signature", () => {
    const storage = new Map<string, string>();
    const session = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    const key = initiateCheckoutStorageKey("variant-1:2");
    assert.equal(shouldFireDedupedEvent(session, key), true);
    assert.equal(shouldFireDedupedEvent(session, key), false);
  });
});

describe("Meta Purchase payload", () => {
  it("maps GA4 purchase data to Meta contents and GHS value", () => {
    const gaPurchase = buildPurchaseEvent({
      orderNumber: "OI-10042",
      totalGhs: 770,
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

    const payload = buildMetaPurchaseEvent(gaPurchase);

    assert.equal(payload.currency, META_CURRENCY);
    assert.equal(payload.value, 770);
    assert.equal(payload.num_items, 2);
    assert.deepEqual(payload.content_ids, ["variant-1", "variant-2"]);
    assert.equal(payload.contents[0]?.item_price, 450);
  });

  it("dedupes Purchase by order ID", () => {
    const storage = new Map<string, string>();
    const session = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    const orderId = "11111111-1111-1111-1111-111111111111";
    const key = metaPurchaseStorageKey(orderId);
    assert.equal(shouldFireDedupedEvent(session, key), true);
    assert.equal(shouldFireDedupedEvent(session, key), false);
  });
});

describe("Meta payload privacy", () => {
  it("does not include PII fields in ecommerce payloads", () => {
    const payloads = [
      buildMetaViewContentEvent({
        productId: "product-1",
        productName: "Silk Blouse",
        categoryName: "Tops",
        priceGhs: 450,
      }),
      buildMetaAddToCartEvent(sampleLine, 1),
      buildMetaInitiateCheckoutEvent([sampleLine], 900),
      buildMetaPurchaseEvent(
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
            },
          ],
        })
      ),
    ];

    for (const payload of payloads) {
      assert.equal(metaPayloadContainsPii(payload), false);
    }
  });

  it("detects forbidden PII keys", () => {
    assert.equal(metaPayloadContainsPii({ email: "shopper@example.com" }), true);
    assert.equal(metaPayloadContainsPii({ content_name: "Dress" }), false);
  });
});
