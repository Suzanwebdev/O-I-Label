import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { buildPurchaseEvent } from "../lib/analytics/ga4-events.ts";
import { buildMetaPurchaseEvent } from "../lib/analytics/meta-events.ts";
import {
  buildMetaCapiEventsUrl,
  getMetaCapiConfig,
  isMetaCapiEnabled,
} from "../lib/analytics/meta-capi-config.ts";
import {
  buildMetaCapiPurchaseEvent,
  buildMetaCapiPurchaseRequestBody,
  dispatchMetaCapiPurchaseIfNeeded,
  META_CAPI_PURCHASE_ORDER_EVENT_TYPE,
  postMetaCapiPurchaseEvent,
} from "../lib/analytics/meta-capi-purchase.ts";

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

const previousEnv = {
  META_PIXEL_ID: process.env.META_PIXEL_ID,
  NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  META_CONVERSIONS_API_ACCESS_TOKEN: process.env.META_CONVERSIONS_API_ACCESS_TOKEN,
  META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
  META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE,
  APP_BASE_URL: process.env.APP_BASE_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function enableMetaCapiEnv() {
  process.env.META_PIXEL_ID = "2051174339097074";
  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = "test-access-token";
  process.env.META_GRAPH_API_VERSION = "v26.0";
  process.env.APP_BASE_URL = "https://www.oandilabel.com";
}

type OrderEventRow = {
  order_id: string;
  event_type: string;
  meta?: Record<string, unknown>;
};

function createMockSupabase(options: {
  paidOrder?: Record<string, unknown> | null;
  existingCapiEvent?: boolean;
  orderEvents?: OrderEventRow[];
}) {
  const orderEvents = options.orderEvents ?? [];
  if (options.existingCapiEvent) {
    orderEvents.push({
      order_id: orderId,
      event_type: META_CAPI_PURCHASE_ORDER_EVENT_TYPE,
    });
  }

  return {
    from(table: string) {
      if (table === "order_events") {
        return {
          select() {
            return {
              eq(_col: string, value: string) {
                return {
                  eq(_col2: string, eventType: string) {
                    return {
                      limit() {
                        return {
                          async maybeSingle() {
                            const row = orderEvents.find(
                              (e) => e.order_id === value && e.event_type === eventType
                            );
                            return { data: row ? { id: "evt-1" } : null };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          async insert(row: OrderEventRow) {
            orderEvents.push(row);
            return { error: null };
          },
        };
      }

      if (table === "orders") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: options.paidOrder ?? null };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    orderEvents,
  };
}

describe("Meta CAPI Purchase payload", () => {
  it("builds Purchase with order UUID event_id and website action_source", () => {
    const event = buildMetaCapiPurchaseEvent({
      orderId,
      purchase: purchasePayload,
      eventSourceUrl: `https://www.oandilabel.com/checkout/success?order=${orderId}`,
      eventTimeSec: 1_700_000_000,
    });

    assert.equal(event.event_name, "Purchase");
    assert.equal(event.event_id, orderId);
    assert.equal(event.action_source, "website");
    assert.equal(event.event_time, 1_700_000_000);
    assert.equal(event.custom_data.currency, "GHS");
    assert.equal(event.custom_data.value, 770);
    assert.deepEqual(event.custom_data.content_ids, ["variant-1", "variant-2"]);
    assert.equal(event.custom_data.content_type, "product");
    assert.equal(event.custom_data.num_items, 2);
    assert.deepEqual(event.custom_data.contents, purchasePayload.contents);
  });

  it("request body excludes access token and can include optional test code", () => {
    enableMetaCapiEnv();
    const config = getMetaCapiConfig();
    assert.ok(config);

    const event = buildMetaCapiPurchaseEvent({
      orderId,
      purchase: purchasePayload,
      eventSourceUrl: "https://www.oandilabel.com/checkout/success",
    });

    const body = buildMetaCapiPurchaseRequestBody(event, config);
    assert.deepEqual(Object.keys(body), ["data"]);
    assert.equal(JSON.stringify(body).includes("test-access-token"), false);

    process.env.META_TEST_EVENT_CODE = "TEST12345";
    const withTest = buildMetaCapiPurchaseRequestBody(event, getMetaCapiConfig()!);
    assert.equal(withTest.test_event_code, "TEST12345");
  });
});

describe("Meta CAPI config", () => {
  it("is enabled only when server credentials exist", () => {
    delete process.env.META_PIXEL_ID;
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
    assert.equal(isMetaCapiEnabled(), false);

    enableMetaCapiEnv();
    assert.equal(isMetaCapiEnabled(), true);
    assert.equal(
      buildMetaCapiEventsUrl(getMetaCapiConfig()!),
      "https://graph.facebook.com/v26.0/2051174339097074/events"
    );
  });
});

describe("Meta CAPI Purchase dispatch", () => {
  it("does not dispatch for unpaid orders", async () => {
    enableMetaCapiEnv();
    let fetchCalls = 0;
    const supabase = createMockSupabase({
      paidOrder: {
        id: orderId,
        order_number: "OI-20260903-59ZF2T",
        total_ghs: 770,
        tax_ghs: 0,
        discount_code: null,
        status: "pending",
        paid_at: null,
        order_items: [],
      },
    });

    const result = await dispatchMetaCapiPurchaseIfNeeded(supabase as never, orderId, {
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    });

    assert.equal(result.ok, true);
    if (result.ok && "skipped" in result) assert.equal(result.reason, "order_not_paid_or_missing");
    assert.equal(fetchCalls, 0);
    assert.equal(supabase.orderEvents.length, 0);
  });

  it("dispatches exactly once for a paid order and records idempotency", async () => {
    enableMetaCapiEnv();
    let fetchCalls = 0;
    const supabase = createMockSupabase({
      paidOrder: {
        id: orderId,
        order_number: "OI-20260903-59ZF2T",
        total_ghs: 770,
        tax_ghs: 0,
        discount_code: null,
        status: "paid",
        paid_at: "2026-09-03T12:13:36.679+00:00",
        order_items: [
          {
            name: "Silk Blouse",
            quantity: 1,
            unit_price_ghs: 450,
            product_id: "product-1",
            variant_id: "variant-1",
            variants: { color: "Black", size: "M" },
          },
          {
            name: "Linen Skirt",
            quantity: 1,
            unit_price_ghs: 320,
            product_id: "product-2",
            variant_id: "variant-2",
            variants: { color: "Ivory", size: "S" },
          },
        ],
      },
    });

    const fetchImpl = async (url: string, init?: RequestInit) => {
      fetchCalls += 1;
      assert.match(url, /graph\.facebook\.com\/v26\.0\/2051174339097074\/events/);
      assert.match(url, /access_token=test-access-token/);
      const body = JSON.parse(String(init?.body)) as {
        data: Array<{ event_id: string; custom_data: { value: number; currency: string } }>;
      };
      assert.equal(body.data[0]?.event_id, orderId);
      assert.equal(body.data[0]?.custom_data.currency, "GHS");
      assert.equal(body.data[0]?.custom_data.value, 770);
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    };

    const first = await dispatchMetaCapiPurchaseIfNeeded(supabase as never, orderId, { fetchImpl });
    assert.equal(first.ok, true);
    if (first.ok && "dispatched" in first) assert.equal(first.dispatched, true);
    assert.equal(fetchCalls, 1);
    assert.equal(supabase.orderEvents.length, 1);
    assert.equal(supabase.orderEvents[0]?.event_type, META_CAPI_PURCHASE_ORDER_EVENT_TYPE);

    const second = await dispatchMetaCapiPurchaseIfNeeded(supabase as never, orderId, { fetchImpl });
    assert.equal(second.ok, true);
    if (second.ok && "skipped" in second) assert.equal(second.reason, "already_dispatched");
    assert.equal(fetchCalls, 1);
  });

  it("does not record idempotency when Meta API fails", async () => {
    enableMetaCapiEnv();
    const supabase = createMockSupabase({
      paidOrder: {
        id: orderId,
        order_number: "OI-20260903-59ZF2T",
        total_ghs: 770,
        tax_ghs: 0,
        discount_code: null,
        status: "paid",
        paid_at: "2026-09-03T12:13:36.679+00:00",
        order_items: [
          {
            name: "Silk Blouse",
            quantity: 1,
            unit_price_ghs: 450,
            product_id: "product-1",
            variant_id: "variant-1",
            variants: null,
          },
        ],
      },
    });

    const result = await dispatchMetaCapiPurchaseIfNeeded(supabase as never, orderId, {
      fetchImpl: async () => new Response("bad request", { status: 400 }),
    });

    assert.equal(result.ok, false);
    assert.equal(supabase.orderEvents.length, 0);
  });

  it("retries transient Meta API failures before giving up", async () => {
    enableMetaCapiEnv();
    let attempts = 0;
    const event = buildMetaCapiPurchaseEvent({
      orderId,
      purchase: purchasePayload,
      eventSourceUrl: "https://www.oandilabel.com/checkout/success",
    });
    const config = getMetaCapiConfig()!;

    const result = await postMetaCapiPurchaseEvent(
      event,
      config,
      async () => {
        attempts += 1;
        if (attempts < 3) return new Response("server error", { status: 503 });
        return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
      }
    );

    assert.equal(result.ok, true);
    assert.equal(attempts, 3);
  });
});

describe("Meta CAPI security boundaries", () => {
  it("does not reference CAPI access token in client analytics files", () => {
    const root = join(process.cwd());
    const clientFiles = [
      "components/analytics/purchase-tracker.tsx",
      "components/analytics/meta-pixel.tsx",
      "components/analytics/meta-page-view.tsx",
      "lib/analytics/meta.ts",
      "lib/analytics/meta-purchase.ts",
    ];

    for (const rel of clientFiles) {
      const src = readFileSync(join(root, rel), "utf8");
      assert.equal(src.includes("META_CONVERSIONS_API_ACCESS_TOKEN"), false, rel);
      assert.equal(src.includes("meta-capi-purchase"), false, rel);
      assert.equal(src.includes("meta-capi-config"), false, rel);
    }
  });

  it("keeps CAPI modules server-only by naming and imports", () => {
    const capi = readFileSync(join(process.cwd(), "lib/analytics/meta-capi-purchase.ts"), "utf8");
    assert.match(capi, /createServiceRoleClient|SupabaseClient/);
    assert.equal(capi.includes('"use client"'), false);
  });
});
