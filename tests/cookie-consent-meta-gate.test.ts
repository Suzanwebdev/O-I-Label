import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { buildConsentDecision, writeConsentState } from "../lib/consent/storage.ts";

const previousWindow = (globalThis as { window?: unknown }).window;
const previousPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const previousGaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function memoryLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "2051174339097074";
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";
  (globalThis as { window: Record<string, unknown> }).window = {
    localStorage: memoryLocalStorage(),
  };
});

afterEach(() => {
  mock.restoreAll();
  if (previousPixelId === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  else process.env.NEXT_PUBLIC_META_PIXEL_ID = previousPixelId;
  if (previousGaId === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = previousGaId;

  if (previousWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window: unknown }).window = previousWindow;
  }
});

describe("Meta track helpers respect marketing consent", () => {
  it("does not fire Meta events without marketing consent even if fbq exists", async () => {
    const fbq = mock.fn();
    (window as { fbq?: typeof fbq }).fbq = fbq;
    writeConsentState(buildConsentDecision({ analytics: false, marketing: false }));

    const { trackMetaPageView, trackMetaPurchase } = await import("../lib/analytics/meta.ts");
    trackMetaPageView();
    const sent = trackMetaPurchase(
      {
        content_ids: ["p1"],
        content_type: "product",
        value: 10,
        currency: "GHS",
        contents: [{ id: "p1", quantity: 1, item_price: 10 }],
        num_items: 1,
      },
      "order-uuid"
    );

    assert.equal(sent, false);
    assert.equal(fbq.mock.callCount(), 0);
  });

  it("fires Meta events when marketing consent is granted", async () => {
    const fbq = mock.fn();
    (window as { fbq?: typeof fbq }).fbq = fbq;
    writeConsentState(buildConsentDecision({ analytics: false, marketing: true }));

    // Fresh module state not required; canUseMarketing reads storage each call.
    const { trackMetaPageView, trackMetaPurchase } = await import("../lib/analytics/meta.ts");
    trackMetaPageView();
    const sent = trackMetaPurchase(
      {
        content_ids: ["p1"],
        content_type: "product",
        value: 10,
        currency: "GHS",
        contents: [{ id: "p1", quantity: 1, item_price: 10 }],
        num_items: 1,
      },
      "order-uuid"
    );

    assert.equal(sent, true);
    assert.equal(fbq.mock.callCount(), 2);
    const purchaseCall = fbq.mock.calls[1];
    assert.equal(purchaseCall.arguments[0], "track");
    assert.equal(purchaseCall.arguments[1], "Purchase");
    assert.deepEqual(purchaseCall.arguments[3], { eventID: "order-uuid" });
  });
});
