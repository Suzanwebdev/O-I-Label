import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { buildPurchaseEvent } from "../lib/analytics/ga4-events.ts";
import { buildMetaPurchaseEvent, metaPurchaseStorageKey } from "../lib/analytics/meta-events.ts";
import { tryDispatchMetaPurchaseWithDedupe } from "../lib/analytics/meta-purchase.ts";

const orderId = "005141b2-d87c-4052-8438-22f5fd381dcc";

const purchasePayload = buildMetaPurchaseEvent(
  buildPurchaseEvent({
    orderNumber: "OI-20260903-59ZF2T",
    totalGhs: 770,
    items: [
      {
        product_id: "product-1",
        variant_id: "variant-1",
        name: "Silk Blouse",
        quantity: 1,
        unit_price_ghs: 450,
      },
      {
        product_id: "product-2",
        variant_id: "variant-2",
        name: "Linen Skirt",
        quantity: 1,
        unit_price_ghs: 320,
      },
    ],
  })
);

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    raw: map,
  };
}

const previousPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

afterEach(() => {
  if (previousPixelId === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  else process.env.NEXT_PUBLIC_META_PIXEL_ID = previousPixelId;
});

describe("Meta Purchase dispatch with deferred dedupe", () => {
  it("keeps Purchase eligible when fbq is unavailable and does not write dedupe", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "2051174339097074";
    const storage = memoryStorage();
    const key = metaPurchaseStorageKey(orderId);

    const result = tryDispatchMetaPurchaseWithDedupe(
      storage,
      orderId,
      purchasePayload,
      () => false
    );

    assert.equal(result, "not_ready");
    assert.equal(storage.getItem(key), null);

    const retry = tryDispatchMetaPurchaseWithDedupe(
      storage,
      orderId,
      purchasePayload,
      () => true
    );
    assert.equal(retry, "sent");
    assert.equal(storage.getItem(key), "1");
  });

  it("writes dedupe only after successful fbq dispatch", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "2051174339097074";
    const storage = memoryStorage();
    let calls = 0;

    const result = tryDispatchMetaPurchaseWithDedupe(
      storage,
      orderId,
      purchasePayload,
      (params, id) => {
        calls += 1;
        assert.equal(id, orderId);
        assert.equal(params.currency, "GHS");
        assert.equal(params.value, 770);
        assert.deepEqual(params.content_ids, ["variant-1", "variant-2"]);
        assert.equal(params.num_items, 2);
        assert.equal(storage.getItem(metaPurchaseStorageKey(orderId)), null);
        return true;
      }
    );

    assert.equal(result, "sent");
    assert.equal(calls, 1);
    assert.equal(storage.getItem(metaPurchaseStorageKey(orderId)), "1");
  });

  it("does not create duplicate Purchase events on repeated dispatch", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "2051174339097074";
    const storage = memoryStorage();
    let calls = 0;
    const dispatch = () => {
      calls += 1;
      return true;
    };

    assert.equal(tryDispatchMetaPurchaseWithDedupe(storage, orderId, purchasePayload, dispatch), "sent");
    assert.equal(
      tryDispatchMetaPurchaseWithDedupe(storage, orderId, purchasePayload, dispatch),
      "already"
    );
    assert.equal(
      tryDispatchMetaPurchaseWithDedupe(storage, orderId, purchasePayload, dispatch),
      "already"
    );
    assert.equal(calls, 1);
  });

  it("preserves existing Purchase payload semantics", () => {
    assert.equal(purchasePayload.currency, "GHS");
    assert.equal(purchasePayload.value, 770);
    assert.equal(purchasePayload.content_type, "product");
    assert.deepEqual(purchasePayload.content_ids, ["variant-1", "variant-2"]);
    assert.deepEqual(purchasePayload.contents, [
      { id: "variant-1", quantity: 1, item_price: 450 },
      { id: "variant-2", quantity: 1, item_price: 320 },
    ]);
    assert.equal(purchasePayload.num_items, 2);
    assert.equal(metaPurchaseStorageKey(orderId), `meta:purchase:${orderId}`);
  });

  it("does not fire when Meta Pixel is disabled", () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const storage = memoryStorage();
    let calls = 0;

    const result = tryDispatchMetaPurchaseWithDedupe(
      storage,
      orderId,
      purchasePayload,
      () => {
        calls += 1;
        return true;
      }
    );

    assert.equal(result, "disabled");
    assert.equal(calls, 0);
    assert.equal(storage.getItem(metaPurchaseStorageKey(orderId)), null);
  });
});
