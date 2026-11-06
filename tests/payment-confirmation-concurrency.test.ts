import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { ReactElement, ReactNode } from "react";

/**
 * Payment confirmation under concurrency. Supabase is an in-memory PostgREST fake
 * (global fetch) that applies conditional updates atomically and returns the
 * affected rows, like Postgres row locking. Moolre, Resend, Moolre SMS and Meta
 * are intercepted at fetch; nothing leaves the process. Every fake response first
 * yields to the event loop, so calls started together genuinely interleave.
 */

type Row = Record<string, unknown>;

const ORDER_ID = "11111111-2222-3333-4444-555555555555";
const PAYMENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const REF = "MOOLRE-REF-001";
const WEBHOOK_SECRET = "unit-test-webhook-secret";
const VARIANT_A = "a0000000-0000-0000-0000-00000000000a";
const VARIANT_B = "b0000000-0000-0000-0000-00000000000b";

const state = {
  payments: [] as Row[],
  orders: [] as Row[],
  order_items: [] as Row[],
  variants: [] as Row[],
  order_events: [] as Row[],
  order_status_events: [] as Row[],
  inventory_movements: [] as Row[],
  webhook_logs: [] as Row[],
  moolrePaid: true,
  failPaymentUpdate: false,
  failOrderUpdate: false,
  failStatusHistoryInsert: false,
  beforePaymentUpdate: null as null | ((payment: Row) => void),
  beforeOrderUpdate: null as null | ((order: Row) => void),
};

type Call = { host: string; path: string; method: string; url: URL; body: unknown };
const calls: Call[] = [];
const operationalEvents: Array<{ code: string; severity: string; metadata: Record<string, unknown> }> = [];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function values(expr: string): string[] {
  return expr
    .replace(/^in\.\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((v) => v.replace(/^"|"$/g, ""));
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [col, expr] of params) {
    if (["select", "order", "limit", "offset"].includes(col)) continue;
    const v = row[col];
    if (expr.startsWith("eq.")) {
      if (v === null || v === undefined || String(v) !== expr.slice(3)) return false;
    } else if (expr.startsWith("in.(")) {
      if (!values(expr).includes(String(v))) return false;
    } else if (expr === "is.null") {
      if (v !== null && v !== undefined) return false;
    } else if (expr === "not.is.null") {
      if (v === null || v === undefined) return false;
    } else if (expr.startsWith("gte.")) {
      if (String(v) < expr.slice(4)) return false;
    } else {
      throw new Error(`unsupported filter ${col}=${expr}`);
    }
  }
  return true;
}

function tableRows(table: string): Row[] {
  const rows = (state as unknown as Record<string, Row[]>)[table];
  if (!Array.isArray(rows)) throw new Error(`unknown table ${table}`);
  return rows;
}

function withNested(table: string, row: Row, select: string | null): Row {
  if (table === "orders" && select?.includes("order_items")) {
    return {
      ...row,
      order_items: state.order_items
        .filter((i) => i.order_id === row.id)
        .map((i) => ({ ...i, variants: { color: "Black", size: "M" } })),
    };
  }
  return { ...row };
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  await new Promise((resolve) => setImmediate(resolve));
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  calls.push({ host: url.host, path: url.pathname, method, url, body });

  if (url.host === "api.moolre.com" && url.pathname === "/open/transact/status") {
    return json({ status: state.moolrePaid ? 1 : 0, data: { txstatus: state.moolrePaid ? 1 : 0 } });
  }
  if (url.host === "api.moolre.com" && url.pathname === "/open/sms/send") return json({ status: 1 });
  if (url.host === "api.resend.com") return json({ id: `email_${calls.length}` });
  if (url.host === "graph.facebook.com") return json({ events_received: 1 });
  if (url.host !== "unit-test.supabase.co") throw new Error(`unexpected external call ${url.href}`);

  if (url.pathname === "/rest/v1/rpc/deduct_variant_stock") {
    const { p_variant_id, p_quantity } = body as { p_variant_id: string; p_quantity: number };
    const variant = state.variants.find((v) => v.id === p_variant_id);
    if (!variant || Number(variant.stock) < p_quantity) return json([]);
    variant.stock = Number(variant.stock) - p_quantity;
    return json([{ variant_id: p_variant_id, stock_after: variant.stock }]);
  }

  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select");
  const wantsObject = (new Headers(init?.headers).get("accept") ?? "").includes("vnd.pgrst.object");

  if (method === "GET") {
    let rows = tableRows(table).filter((r) => matches(r, url.searchParams));
    const order = url.searchParams.get("order");
    if (order?.startsWith("created_at.desc")) rows = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const limit = url.searchParams.get("limit");
    if (limit) rows = rows.slice(0, Number(limit));
    const out = rows.map((r) => withNested(table, r, select));
    if (wantsObject) return out.length === 1 ? json(out[0]) : json({ code: "PGRST116", message: "not one row" }, 406);
    return json(out);
  }

  if (method === "POST") {
    if (table === "order_status_events" && state.failStatusHistoryInsert) {
      return json({ message: "insert failed", code: "23503" }, 409);
    }
    const inserted = (Array.isArray(body) ? body : [body]).map((r: Row) => ({
      id: `${table}_${tableRows(table).length + 1}`,
      created_at: new Date().toISOString(),
      ...r,
    }));
    tableRows(table).push(...inserted);
    return json(inserted, 201);
  }

  if (method === "PATCH") {
    if (table === "payments") {
      if (state.failPaymentUpdate) return json({ message: "payments update failed", code: "XX000" }, 500);
      const target = state.payments.find((p) => p.id === url.searchParams.get("id")?.replace(/^eq\./, ""));
      if (target) state.beforePaymentUpdate?.(target);
    }
    if (table === "orders") state.beforeOrderUpdate?.(state.orders[0]);
    if (table === "orders" && state.failOrderUpdate) return json({ message: "orders update failed", code: "57014" }, 500);
    // Evaluate and apply in one synchronous step: concurrent updates are serialised.
    const hit = tableRows(table).filter((r) => matches(r, url.searchParams));
    for (const r of hit) Object.assign(r, body as Row);
    return json(hit.map((r) => ({ ...r })));
  }

  throw new Error(`unsupported ${method} ${url.pathname}`);
}

function db(table: string, method: string): Call[] {
  return calls.filter((c) => c.host === "unit-test.supabase.co" && c.path === `/rest/v1/${table}` && c.method === method);
}

function external(host: string, path?: string): Call[] {
  return calls.filter((c) => c.host === host && (!path || c.path === path));
}

function events(type: string): Row[] {
  return state.order_events.filter((e) => e.event_type === type);
}

/** Exactly one full confirmation's side effects happened. */
function assertSideEffectsOnce() {
  const claims = db("payments", "PATCH");
  assert.ok(claims.length >= 1);
  assert.equal(db("orders", "PATCH").length, 1, "order marked paid once");
  assert.equal(state.order_status_events.length, 1, "one order_status_events row");
  assert.equal(events("payment_received").length, 1, "one payment_received event");
  assert.equal(calls.filter((c) => c.path === "/rest/v1/rpc/deduct_variant_stock").length, 2, "each variant deducted once");
  assert.equal(state.inventory_movements.length, 2);
  assert.equal(events("inventory_deducted").length, 1);
  assert.equal(state.variants.find((v) => v.id === VARIANT_A)?.stock, 8, "variant A: 10 - 2");
  assert.equal(state.variants.find((v) => v.id === VARIANT_B)?.stock, 4, "variant B: 5 - 1");
  assert.equal(external("api.resend.com").length, 1, "one confirmation email");
  assert.equal(external("api.moolre.com", "/open/sms/send").length, 1, "one SMS");
  // Winner-only: one Meta Purchase dispatch attempt, carrying event_id = order ID.
  const metaPosts = external("graph.facebook.com");
  assert.equal(metaPosts.length, 1, "one Meta Purchase dispatch attempt");
  assert.equal((metaPosts[0].body as { data: Array<{ event_id: string }> }).data[0].event_id, ORDER_ID);
  assert.equal(events("meta_capi_purchase").length, 1);
  assert.equal(state.payments[0].status, "paid");
  assert.equal(state.orders[0].status, "paid");
}

function assertNoSideEffects() {
  assert.equal(db("orders", "PATCH").length, 0);
  assert.equal(state.order_status_events.length, 0);
  assert.equal(events("payment_received").length, 0);
  assert.equal(calls.filter((c) => c.path === "/rest/v1/rpc/deduct_variant_stock").length, 0);
  assert.equal(state.inventory_movements.length, 0);
  assert.equal(external("api.resend.com").length, 0);
  assert.equal(external("api.moolre.com", "/open/sms/send").length, 0);
}

function webhookBody(amount = 150): { raw: string; parsed: unknown } {
  const parsed = {
    status: 1,
    code: "P01",
    data: { reference: REF, amount: String(amount), txstatus: 1, metadata: { order_id: ORDER_ID } },
  };
  return { raw: JSON.stringify(parsed), parsed };
}

type MarkModule = typeof import("../lib/payments/mark-order-paid");
type ReconcileModule = typeof import("../lib/payments/reconcile-payment");
type WebhookModule = typeof import("../lib/payments/handle-webhook");
type CaptureModule = typeof import("../lib/errors/capture-event");
type StatusRouteModule = typeof import("../app/api/checkout/payment-status/route");
type TokenModule = typeof import("../lib/auth/signed-token");
type SuccessPageModule = typeof import("../app/(store)/checkout/success/page");
type SupabaseServerModule = typeof import("../lib/supabase/server");
let successPage: SuccessPageModule;
let supabaseServer: SupabaseServerModule;
let mark: MarkModule;
let reconcile: ReconcileModule;
let webhook: WebhookModule;
let capture: CaptureModule;
let statusRoute: StatusRouteModule;
let tokens: TokenModule;

const ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://unit-test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "unit-test-service-role-key",
  MOOLRE_API_USER: "unit-user",
  MOOLRE_API_PUBKEY: "unit-pubkey",
  MOOLRE_ACCOUNT_NUMBER: "unit-account",
  MOOLRE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  MOOLRE_SMS_VASKEY: "unit-vas",
  MOOLRE_SMS_SENDER_ID: "OILABEL",
  MOOLRE_SMS_ORDER_NOTIFICATIONS: "1",
  RESEND_API_KEY: "re_unit_test",
  RESEND_FROM: "O & I Label <orders@example.com>",
  INSTAGRAM_URL: "https://instagram.com/oandilabel",
  META_PIXEL_ID: "1234567890",
  META_CONVERSIONS_API_ACCESS_TOKEN: "unit-meta-token",
  APP_BASE_URL: "https://www.oandilabel.com",
};
const savedEnv: Record<string, string | undefined> = {};
/** In-memory operational-event store that records every captured event into `operationalEvents`. */
let recordingStore: NonNullable<Parameters<CaptureModule["setOperationalEventTestStore"]>[0]>;
const consoleMocks = [mock.method(console, "warn", () => {}), mock.method(console, "error", () => {})];

before(async () => {
  for (const [k, v] of Object.entries(ENV)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
  globalThis.fetch = fakeFetch as typeof fetch;
  capture = await import("../lib/errors/capture-event");
  recordingStore = {
    async findOpenByFingerprint() {
      return null;
    },
    async insert(row) {
      operationalEvents.push({
        code: String(row.metadata.code ?? ""),
        severity: row.severity,
        metadata: row.metadata,
      });
      return { ...row, id: `op_${operationalEvents.length}`, acknowledged_by: null, resolved_at: null };
    },
    async incrementOccurrence() {
      throw new Error("not used");
    },
  };
  capture.setOperationalEventTestStore(recordingStore);
  mark = await import("../lib/payments/mark-order-paid");
  reconcile = await import("../lib/payments/reconcile-payment");
  webhook = await import("../lib/payments/handle-webhook");
  statusRoute = await import("../app/api/checkout/payment-status/route");
  tokens = await import("../lib/auth/signed-token");
  successPage = await import("../app/(store)/checkout/success/page");
  supabaseServer = await import("../lib/supabase/server");
});

after(() => {
  capture.setOperationalEventTestStore(null);
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  for (const m of consoleMocks) m.mock.restore();
});

beforeEach(() => {
  state.payments = [
    {
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      provider: "moolre",
      reference: REF,
      amount_ghs: 150,
      status: "pending",
      created_at: "2026-11-06T10:00:00.000Z",
      updated_at: "2026-11-06T10:00:00.000Z",
    },
  ];
  state.orders = [
    {
      id: ORDER_ID,
      order_number: "OI-20261106-ABC123",
      email: "customer@example.com",
      phone: "0241234567",
      total_ghs: 150,
      subtotal_ghs: 140,
      shipping_ghs: 10,
      tax_ghs: 0,
      discount_ghs: 0,
      discount_code: null,
      notify_customer: true,
      status: "pending",
      paid_at: null,
      created_at: "2026-11-06T10:00:00.000Z",
      shipping_address: { line1: "1 Test Street", city: "Accra", region: "Greater Accra" },
    },
  ];
  state.order_items = [
    { id: "item_1", order_id: ORDER_ID, variant_id: VARIANT_A, product_id: "p1", quantity: 2, name: "Silk Dress", sku: "SD-M", unit_price_ghs: 50 },
    { id: "item_2", order_id: ORDER_ID, variant_id: VARIANT_B, product_id: "p2", quantity: 1, name: "Linen Top", sku: "LT-M", unit_price_ghs: 40 },
  ];
  state.variants = [
    { id: VARIANT_A, stock: 10 },
    { id: VARIANT_B, stock: 5 },
  ];
  state.order_events = [];
  state.order_status_events = [];
  state.inventory_movements = [];
  state.webhook_logs = [];
  state.moolrePaid = true;
  state.failPaymentUpdate = false;
  state.failOrderUpdate = false;
  state.failStatusHistoryInsert = false;
  state.beforePaymentUpdate = null;
  state.beforeOrderUpdate = null;
  calls.length = 0;
  operationalEvents.length = 0;
});

const reconcileMark = () =>
  mark.markOrderPaidByReference(REF, "moolre", "reconcile", { skipAmountCheck: true, orderId: ORDER_ID });
const deliverWebhook = (amount = 150) => {
  const { raw, parsed } = webhookBody(amount);
  return webhook.handleProviderWebhook("moolre", raw, WEBHOOK_SECRET, parsed);
};

describe("concurrent confirmations: exactly one winner", () => {
  it("a sequential Meta dispatch is sent once (marker checked before sending)", async () => {
    await reconcileMark();
    await reconcileMark();
    assert.equal(external("graph.facebook.com").length, 1);
    assert.equal(events("meta_capi_purchase").length, 1);
  });

  it("two simultaneous confirmations of the same payment: one claims, one is idempotent", async () => {
    const results = await Promise.all([reconcileMark(), reconcileMark()]);
    const winners = results.filter((r) => r.ok && !r.idempotent);
    const losers = results.filter((r) => r.ok && r.idempotent);
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    // Both really overlapped: both reached the claim before either finished.
    const claims = db("payments", "PATCH");
    assert.equal(claims.length, 2, "both requests attempted the claim");
    assert.equal(claims[0].url.searchParams.get("status"), "in.(pending,processing,failed)");
    assert.equal(claims[0].url.searchParams.get("select"), "id");
    assertSideEffectsOnce();
  });

  it("four overlapping confirmations: one winner and exactly one Meta Purchase dispatch attempt", async () => {
    const results = await Promise.all([reconcileMark(), reconcileMark(), reconcileMark(), reconcileMark()]);
    assert.equal(results.filter((r) => r.ok && !r.idempotent).length, 1);
    assert.equal(results.filter((r) => r.ok && r.idempotent).length, 3);
    assert.equal(db("payments", "PATCH").length, 4, "all four overlapped up to the claim");
    assertSideEffectsOnce();
    const metaMarkerChecks = calls.filter(
      (c) => c.path === "/rest/v1/order_events" && c.url.searchParams.get("event_type") === "eq.meta_capi_purchase"
    );
    assert.equal(metaMarkerChecks.length, 1, "losers never even start a Meta dispatch");
  });

  it("an already-paid payment returns idempotently without a Meta dispatch, even with no Meta marker", async () => {
    state.payments[0].status = "paid";
    state.orders[0].status = "paid";
    state.orders[0].paid_at = "2026-11-06T10:01:00.000Z";
    const result = await reconcileMark();
    assert.deepEqual(result, { ok: true, orderId: ORDER_ID, idempotent: true });
    assert.equal(external("graph.facebook.com").length, 0);
    assert.equal(events("meta_capi_purchase").length, 0);
    assertNoSideEffects();
  });

  it("a webhook and a reconciliation overlapping: one winner", async () => {
    const [hook, recon] = await Promise.all([deliverWebhook(), reconcile.reconcileOrderPayment(ORDER_ID)]);
    assert.equal(hook.ok, true);
    assert.ok(recon.ok && recon.paid);
    assertSideEffectsOnce();
    assert.equal(external("api.moolre.com", "/open/transact/status").length, 1, "reconcile asked Moolre once");
  });

  it("two simultaneous webhook deliveries: one winner", async () => {
    const results = await Promise.all([deliverWebhook(), deliverWebhook()]);
    assert.ok(results.every((r) => r.ok));
    assert.equal(results.filter((r) => r.ok && r.idempotent).length, 1);
    assertSideEffectsOnce();
  });

  it("a confirmation after completion is idempotent and adds no side effects", async () => {
    await reconcileMark();
    calls.length = 0;
    const second = await reconcileMark();
    assert.ok(second.ok && second.idempotent);
    assert.equal(db("payments", "PATCH").length, 0);
    assert.equal(db("orders", "PATCH").length, 0);
    assert.equal(external("api.resend.com").length, 0);
    assert.equal(external("api.moolre.com", "/open/sms/send").length, 0);
    assert.equal(external("graph.facebook.com").length, 0, "Meta marker already present");
    assert.equal(events("payment_received").length, 1);
  });
});

describe("refunded payments are never confirmed again", () => {
  beforeEach(() => {
    state.payments[0].status = "refunded";
    state.orders[0].status = "refunded";
    state.orders[0].paid_at = "2026-11-05T10:00:00.000Z";
  });

  it("reconciliation returns early without calling Moolre", async () => {
    const result = await reconcile.reconcileOrderPayment(ORDER_ID);
    assert.deepEqual(result, { ok: true, paid: false, reason: "payment_refunded" });
    assert.equal(external("api.moolre.com").length, 0);
    assert.equal(db("payments", "PATCH").length, 0);
    assertNoSideEffects();
  });

  it("direct confirmation returns payment_refunded with no status change or side effects", async () => {
    const result = await reconcileMark();
    assert.deepEqual(result, { ok: false, reason: "payment_refunded" });
    assert.equal(db("payments", "PATCH").length, 0);
    assert.equal(state.payments[0].status, "refunded");
    assert.equal(state.orders[0].status, "refunded");
    assertNoSideEffects();
  });

  it("a redelivered webhook for a refunded payment is rejected without side effects", async () => {
    const result = await deliverWebhook();
    assert.deepEqual(result, { ok: false, reason: "payment_refunded" });
    assert.equal(state.payments[0].status, "refunded");
    assertNoSideEffects();
  });

  it("the admin confirm route explains a refunded payment instead of 'stays unpaid'", () => {
    const route = readFileSync("app/api/admin/orders/[orderId]/confirm-payment/route.ts", "utf8");
    assert.match(route, /reason === "payment_refunded"\s*\?\s*"This payment was refunded and cannot be confirmed again\."/);
    assert.match(route, /if \(reconciled\.ok && reconciled\.paid\)/, "success still requires paid");
  });
});

describe("claim outcomes and failures", () => {
  it("a payment update error stops before any side effects", async () => {
    state.failPaymentUpdate = true;
    const result = await reconcileMark();
    assert.deepEqual(result, { ok: false, reason: "payment_update" });
    assertNoSideEffects();
    assert.equal(state.payments[0].status, "pending");
  });

  it("zero rows claimed, re-read shows paid: idempotent, no side effects", async () => {
    state.beforePaymentUpdate = (p) => {
      p.status = "paid";
      state.beforePaymentUpdate = null;
    };
    const result = await reconcileMark();
    assert.deepEqual(result, { ok: true, orderId: ORDER_ID, idempotent: true });
    assertNoSideEffects();
    assert.equal(external("graph.facebook.com").length, 0, "the loser does not dispatch Meta");
  });

  it("zero rows claimed, re-read shows refunded: payment_refunded, no side effects", async () => {
    state.beforePaymentUpdate = (p) => {
      p.status = "refunded";
      state.beforePaymentUpdate = null;
    };
    const result = await reconcileMark();
    assert.deepEqual(result, { ok: false, reason: "payment_refunded" });
    assertNoSideEffects();
  });

  it("zero rows claimed with any other status: safe failure, no side effects", async () => {
    state.beforePaymentUpdate = (p) => {
      p.status = "chargeback";
      state.beforePaymentUpdate = null;
    };
    const result = await reconcileMark();
    assert.deepEqual(result, { ok: false, reason: "payment_not_claimed" });
    assertNoSideEffects();
  });

  it("an order update error: reported, not success, and no false status history", async () => {
    state.failOrderUpdate = true;
    const result = await reconcileMark();
    assert.deepEqual(result, { ok: false, reason: "order_update_failed" });
    await new Promise((r) => setImmediate(r));
    const event = operationalEvents.find((e) => e.code === "paid_order_status_update_failed");
    assert.ok(event, "operational event recorded");
    assert.equal(event?.severity, "critical");
    assert.equal(event?.metadata.error_code, "57014");
    assert.doesNotMatch(JSON.stringify(event), /customer@example\.com|0241234567|unit-meta-token|re_unit_test/);
    // The claim is kept; the order row did not change.
    assert.equal(state.payments[0].status, "paid");
    assert.equal(state.orders[0].status, "pending");
    assert.equal(state.orders[0].paid_at, null);
    // No status-history row claiming pending → paid; the payment event says what happened.
    assert.equal(state.order_status_events.length, 0);
    const received = events("payment_received");
    assert.equal(received.length, 1);
    assert.match(String(received[0].message), /order status update failed/);
    assert.equal((received[0].meta as Row).order_update_failed, true);
    // The payment really was received: stock and customer notifications happen exactly once.
    assert.equal(events("inventory_deducted").length, 1);
    assert.equal(state.inventory_movements.length, 2);
    assert.equal(external("api.resend.com").length, 1);
    assert.equal(external("api.moolre.com", "/open/sms/send").length, 1);
    // The existing Meta code only sends a Purchase for an order row marked paid, so none is sent.
    assert.equal(external("graph.facebook.com").length, 0);
  });

  it("after an order update failure, later confirmations never repeat stock or notifications", async () => {
    state.failOrderUpdate = true;
    await reconcileMark();
    state.failOrderUpdate = false;
    const before = calls.length;
    const results = await Promise.all([reconcileMark(), deliverWebhook()]);
    assert.ok(results.every((r) => r.ok && "idempotent" in r && r.idempotent));
    const later = calls.slice(before);
    assert.equal(later.filter((c) => c.path === "/rest/v1/rpc/deduct_variant_stock").length, 0);
    assert.equal(later.filter((c) => c.host === "api.resend.com").length, 0);
    assert.equal(later.filter((c) => c.path === "/open/sms/send").length, 0);
    assert.equal(later.filter((c) => c.host === "graph.facebook.com").length, 0);
    assert.equal(events("inventory_deducted").length, 1);
  });
});

describe("existing behaviour preserved", () => {
  it("webhook amount mismatch is still rejected before any write", async () => {
    const result = await deliverWebhook(99);
    assert.deepEqual(result, { ok: false, reason: "amount_mismatch" });
    assert.equal(db("payments", "PATCH").length, 0);
    assertNoSideEffects();
  });

  it("skipAmountCheck still bypasses the amount check on the reconcile path", async () => {
    state.payments[0].amount_ghs = 99;
    const result = await reconcileMark();
    assert.ok(result.ok && !result.idempotent);
    assertSideEffectsOnce();
  });

  it("bulk reconciliation keeps its filters (Moolre, pending/processing, has reference, recent)", async () => {
    state.moolrePaid = false;
    await reconcile.reconcilePendingPayments({ limit: 40, maxAgeHours: 72 });
    const query = db("payments", "GET")[0].url.searchParams;
    assert.equal(query.get("provider"), "eq.moolre");
    assert.equal(query.get("status"), "in.(pending,processing)");
    assert.equal(query.get("reference"), "not.is.null");
    assert.match(String(query.get("created_at")), /^gte\./);
    for (const [file, call] of [
      ["app/api/cron/reconcile-payments/route.ts", "reconcilePendingPayments({ limit: 40, maxAgeHours: 72 })"],
      ["app/api/admin/orders/reconcile-payments/route.ts", "reconcilePendingPayments({ limit, maxAgeHours: 72 })"],
    ]) {
      assert.ok(readFileSync(file, "utf8").includes(call), file);
    }
  });

  it("the Meta Purchase event ID is still the order ID", async () => {
    await reconcileMark();
    const meta = external("graph.facebook.com")[0];
    const body = meta.body as { data: Array<{ event_id: string; event_name: string }> };
    assert.equal(body.data[0].event_id, ORDER_ID);
    assert.equal(body.data[0].event_name, "Purchase");
  });

  it("sequential confirmations never dispatch Meta again", async () => {
    await reconcileMark();
    await reconcileMark();
    await deliverWebhook();
    await reconcile.reconcileOrderPayment(ORDER_ID);
    assert.equal(external("graph.facebook.com").length, 1);
  });

  it("callers treat payment_refunded as not paid (structure)", () => {
    const status = readFileSync("app/api/checkout/payment-status/route.ts", "utf8");
    assert.match(status, /\(reconciled\.ok && reconciled\.paid\)/);
    const success = readFileSync("app/(store)/checkout/success/page.tsx", "utf8");
    assert.match(success, /reconciled\.ok && reconciled\.paid/);
    const hook = readFileSync("lib/payments/handle-webhook.ts", "utf8");
    assert.match(hook, /if \(!marked\.ok\) \{/);
  });
});

describe("GET /api/checkout/payment-status reports the authoritative payment status", () => {
  let ipCounter = 0;

  async function poll(opts: { token?: string | null; order?: string | null } = {}) {
    const token = opts.token === undefined ? tokens.createOrderAccessToken(ORDER_ID) : opts.token;
    const order = opts.order === undefined ? ORDER_ID : opts.order;
    const params = new URLSearchParams();
    if (order !== null) params.set("order", order);
    if (token !== null) params.set("token", token);
    ipCounter += 1;
    const res = await statusRoute.GET(
      new Request(`https://www.oandilabel.com/api/checkout/payment-status?${params}`, {
        headers: { "x-forwarded-for": `198.51.100.${ipCounter}` },
      })
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it("a paid payment is reported as paid, with the existing response shape", async () => {
    state.payments[0].status = "paid";
    Object.assign(state.orders[0], { status: "paid", paid_at: "2026-11-06T10:01:00.000Z" });
    const { status, body } = await poll();
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(body).sort(), ["ok", "orderNumber", "paid", "reconciled", "reference", "status"]);
    assert.equal(body.paid, true);
    assert.equal(body.status, "paid");
    assert.equal(body.reference, REF);
    assert.equal(external("api.moolre.com").length, 0);
  });

  it("a recorded refund is never reported as paid, even though orders.paid_at is set", async () => {
    state.payments[0].status = "refunded";
    Object.assign(state.orders[0], { status: "refunded", paid_at: "2026-11-05T10:00:00.000Z" });
    const { status, body } = await poll();
    assert.equal(status, 200);
    assert.equal(body.paid, false);
    assert.equal(body.status, "refunded");
    assert.equal(body.reconciled, false);
    assert.equal(external("api.moolre.com").length, 0, "no Moolre call for a refunded payment");
    assert.equal(db("payments", "PATCH").length, 0);
    assert.equal(db("orders", "PATCH").length, 0);
  });

  for (const pendingStatus of ["pending", "processing"]) {
    it(`a ${pendingStatus} payment Moolre has not confirmed stays pending (existing behaviour)`, async () => {
      state.payments[0].status = pendingStatus;
      state.moolrePaid = false;
      const { body } = await poll();
      assert.equal(body.paid, false);
      assert.equal(body.status, "pending");
      assert.equal(external("api.moolre.com", "/open/transact/status").length, 1);
      assert.equal(db("payments", "PATCH").length, 0);
    });
  }

  it("a pending payment Moolre has confirmed is reconciled and reported paid (existing behaviour)", async () => {
    const { body } = await poll();
    assert.equal(body.paid, true);
    assert.equal(body.status, "paid");
    assert.equal(body.reconciled, true);
    assert.equal(state.payments[0].status, "paid");
  });

  it("a failed payment Moolre has not confirmed is reported as failed (existing behaviour)", async () => {
    state.payments[0].status = "failed";
    state.moolrePaid = false;
    const { body } = await poll();
    assert.equal(body.paid, false);
    assert.equal(body.status, "failed");
  });

  it("a claimed payment whose order update failed is still reported paid (payment is authoritative)", async () => {
    state.payments[0].status = "paid";
    const { body } = await poll();
    assert.equal(body.paid, true);
  });

  it("an order with no payment row keeps the existing orders.paid_at fallback", async () => {
    state.payments = [];
    assert.equal((await poll()).body.paid, false, "no payment, not paid_at: pending");
    state.orders[0].paid_at = "2026-11-06T10:01:00.000Z";
    const { body } = await poll();
    assert.equal(body.paid, true);
    assert.equal(body.reference, null);
  });

  it("invalid, foreign or missing tokens are still rejected with 403 before any data access", async () => {
    const otherOrderToken = tokens.createOrderAccessToken("99999999-2222-3333-4444-555555555555");
    for (const opts of [{ token: "forged.value" }, { token: otherOrderToken }, { token: null }, { order: null }]) {
      calls.length = 0;
      const { status, body } = await poll(opts);
      assert.equal(status, 403, JSON.stringify(opts));
      assert.deepEqual(body, { error: "Forbidden" });
      assert.equal(calls.length, 0, "no database or Moolre access");
    }
  });
});

describe("guarded repair of a paid payment whose order update failed", () => {
  /** The state an order update failure leaves behind: payment paid (claimed earlier), order still pending. */
  function incompleteOrder(claimedMinutesAgo = 20) {
    Object.assign(state.payments[0], {
      status: "paid",
      updated_at: new Date(Date.now() - claimedMinutesAgo * 60_000).toISOString(),
    });
    Object.assign(state.orders[0], { status: "pending", paid_at: null });
  }

  function assertNoConfirmationRepeats() {
    assert.equal(calls.filter((c) => c.path === "/rest/v1/rpc/deduct_variant_stock").length, 0, "no stock deduction");
    assert.equal(external("api.resend.com").length, 0, "no email");
    assert.equal(external("api.moolre.com", "/open/sms/send").length, 0, "no SMS");
    assert.equal(events("payment_received").length, 0, "no payment_received event");
    assert.equal(db("payments", "PATCH").length, 0, "payment status untouched");
  }

  it("an already-paid payment whose order is already paid: no repair, no repeats", async () => {
    state.payments[0].status = "paid";
    Object.assign(state.orders[0], { status: "paid", paid_at: "2026-11-06T10:01:00.000Z" });
    assert.deepEqual(await reconcileMark(), { ok: true, orderId: ORDER_ID, idempotent: true });
    assert.deepEqual(await reconcile.reconcileOrderPayment(ORDER_ID), { ok: true, paid: true, idempotent: true });
    assert.equal(db("orders", "PATCH").length, 0);
    assert.equal(state.order_status_events.length, 0);
    assert.equal(external("graph.facebook.com").length, 0);
    assertNoConfirmationRepeats();
  });

  it("paid_at null and an old claim: the guarded repair marks the order paid and sends Meta once", async () => {
    incompleteOrder();
    const claimedAt = state.payments[0].updated_at;
    const result = await reconcileMark();
    assert.deepEqual(result, { ok: true, orderId: ORDER_ID, idempotent: true }, "result unchanged");
    const repair = db("orders", "PATCH");
    assert.equal(repair.length, 1);
    assert.equal(repair[0].url.searchParams.get("paid_at"), "is.null");
    assert.equal(repair[0].url.searchParams.get("status"), "in.(pending,paid)");
    assert.equal(repair[0].url.searchParams.get("select"), "id");
    assert.equal(state.orders[0].status, "paid");
    assert.equal(state.orders[0].paid_at, claimedAt, "paid_at is the original claim time");
    assert.equal(state.order_status_events.length, 1);
    assert.equal(state.order_status_events[0].note, "Order marked paid after an earlier failed status update");
    assert.equal(external("graph.facebook.com").length, 1);
    assert.equal(events("meta_capi_purchase").length, 1);
    assertNoConfirmationRepeats();
  });

  it("the repair also runs from polls, success-page loads and admin confirmation (reconcile path)", async () => {
    incompleteOrder();
    assert.deepEqual(await reconcile.reconcileOrderPayment(ORDER_ID), { ok: true, paid: true, idempotent: true });
    assert.equal(state.orders[0].status, "paid");
    assert.equal(external("graph.facebook.com").length, 1);
    assert.equal(external("api.moolre.com", "/open/transact/status").length, 0, "no Moolre call for a paid payment");
    assertNoConfirmationRepeats();
  });

  it("a recent claim is left alone (its claiming request may still be updating the order)", async () => {
    incompleteOrder(1);
    assert.equal(await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "reconcile"), "too_recent");
    assert.equal(db("orders", "PATCH").length, 0);
    assert.equal(external("graph.facebook.com").length, 0);
    assert.equal(mark.ORDER_REPAIR_GRACE_MS, 10 * 60_000);
  });

  it("a repair update matching zero rows sends nothing (someone else repaired it first)", async () => {
    incompleteOrder();
    state.beforeOrderUpdate = (order) => {
      order.paid_at = "2026-11-06T10:05:00.000Z";
      order.status = "paid";
    };
    assert.equal(await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "webhook"), "lost");
    assert.equal(state.order_status_events.length, 0);
    assert.equal(external("graph.facebook.com").length, 0);
    assertNoConfirmationRepeats();
  });

  it("a repair database error is recorded and nothing is repeated", async () => {
    incompleteOrder();
    state.failOrderUpdate = true;
    assert.equal(await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "reconcile"), "failed");
    await new Promise((r) => setImmediate(r));
    const event = operationalEvents.find((e) => e.code === "paid_order_repair_failed");
    assert.ok(event);
    assert.equal(event?.severity, "critical");
    assert.equal(event?.metadata.error_code, "57014");
    assert.equal(state.order_status_events.length, 0);
    assert.equal(external("graph.facebook.com").length, 0);
    assert.equal(state.orders[0].paid_at, null);
    assertNoConfirmationRepeats();
  });

  it("concurrent repair attempts: one repair, one status event, one Meta dispatch", async () => {
    incompleteOrder();
    const results = await Promise.all([
      reconcileMark(),
      reconcile.reconcileOrderPayment(ORDER_ID),
      deliverWebhook(),
      reconcile.reconcileOrderPayment(ORDER_ID),
    ]);
    assert.ok(results.every((r) => r.ok));
    assert.ok(db("orders", "PATCH").length >= 2, "several requests really raced to repair");
    assert.equal(state.order_status_events.length, 1);
    assert.equal(external("graph.facebook.com").length, 1);
    assert.equal(events("meta_capi_purchase").length, 1);
    assertNoConfirmationRepeats();
  });

  it("an order an admin already moved on is not repaired (no status regression, no Meta)", async () => {
    incompleteOrder();
    state.orders[0].status = "processing";
    assert.equal(await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "reconcile"), "not_repairable");
    assert.equal(db("orders", "PATCH").length, 0);
    assert.equal(state.orders[0].status, "processing");
    assert.equal(external("graph.facebook.com").length, 0);
  });

  it("an order an admin set to paid without paid_at gets paid_at and Meta, without a status event", async () => {
    incompleteOrder();
    state.orders[0].status = "paid";
    assert.equal(await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "reconcile"), "repaired");
    assert.ok(state.orders[0].paid_at);
    assert.equal(state.order_status_events.length, 0);
    assert.equal(external("graph.facebook.com").length, 1);
  });

  it("end to end: a failed order update is later repaired with Meta sent exactly once overall", async () => {
    state.failOrderUpdate = true;
    assert.deepEqual(await reconcileMark(), { ok: false, reason: "order_update_failed" });
    state.failOrderUpdate = false;
    assert.equal(external("graph.facebook.com").length, 0);
    // Later: the claim is older than the grace period.
    state.payments[0].updated_at = new Date(Date.now() - 15 * 60_000).toISOString();
    await reconcile.reconcileOrderPayment(ORDER_ID);
    await reconcile.reconcileOrderPayment(ORDER_ID);
    assert.equal(state.orders[0].status, "paid");
    assert.equal(external("graph.facebook.com").length, 1);
    assert.equal(calls.filter((c) => c.path === "/rest/v1/rpc/deduct_variant_stock").length, 2, "stock deducted once");
    assert.equal(external("api.resend.com").length, 1, "one email overall");
    assert.equal(external("api.moolre.com", "/open/sms/send").length, 1, "one SMS overall");
  });

  describe("status-history insertion after a successful repair", () => {
    const HISTORY_EVENT = "paid_order_repair_status_history_failed";
    const historyInserts = () => db("order_status_events", "POST");

    it("a successful repair and history insert behave as before, with no operational event", async () => {
      incompleteOrder();
      assert.equal(await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "reconcile"), "repaired");
      await new Promise((r) => setImmediate(r));
      assert.equal(historyInserts().length, 1);
      assert.equal(state.order_status_events.length, 1);
      assert.equal(state.orders[0].status, "paid");
      assert.equal(external("graph.facebook.com").length, 1);
      assert.equal(operationalEvents.length, 0, "nothing recorded on success");
    });

    it("a failed history insert is recorded, and the repair still succeeds with Meta sent once", async () => {
      incompleteOrder();
      const claimedAt = state.payments[0].updated_at;
      state.failStatusHistoryInsert = true;
      const outcome = await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "webhook");
      await new Promise((r) => setImmediate(r));
      assert.equal(outcome, "repaired");
      // The repair stands: nothing is rolled back.
      assert.equal(state.orders[0].status, "paid");
      assert.equal(state.orders[0].paid_at, claimedAt);
      assert.equal(historyInserts().length, 1, "attempted exactly once");
      assert.equal(state.order_status_events.length, 0);
      // Recorded under its own code, distinct from a repair failure.
      const event = operationalEvents.find((e) => e.code === HISTORY_EVENT);
      assert.ok(event, "status-history failure recorded");
      assert.equal(event?.severity, "error");
      assert.equal(event?.metadata.source, "webhook");
      assert.equal(event?.metadata.error_code, "23503");
      assert.equal(operationalEvents.filter((e) => e.code === "paid_order_repair_failed").length, 0);
      assert.doesNotMatch(
        JSON.stringify(event),
        new RegExp(`customer@example\\.com|0241234567|${REF}|${ORDER_ID}|${PAYMENT_ID}|unit-meta-token|re_unit_test`)
      );
      // Existing successful-repair Meta behaviour, and no confirmation side effects.
      assert.equal(external("graph.facebook.com").length, 1);
      assert.equal(events("meta_capi_purchase").length, 1);
      assertNoConfirmationRepeats();
    });

    it("after a failed history insert, later calls never repair again or repeat any side effect", async () => {
      incompleteOrder();
      state.failStatusHistoryInsert = true;
      await reconcile.reconcileOrderPayment(ORDER_ID);
      await Promise.all([reconcileMark(), reconcile.reconcileOrderPayment(ORDER_ID), deliverWebhook()]);
      await new Promise((r) => setImmediate(r));
      assert.equal(db("orders", "PATCH").length, 1, "one repair update in total");
      assert.equal(historyInserts().length, 1, "one history attempt in total");
      assert.equal(operationalEvents.filter((e) => e.code === HISTORY_EVENT).length, 1);
      assert.equal(external("graph.facebook.com").length, 1);
      assertNoConfirmationRepeats();
    });

    it("a failure inside the operational-event logger itself changes nothing", async () => {
      incompleteOrder();
      state.failStatusHistoryInsert = true;
      capture.setOperationalEventTestStore({
        ...recordingStore,
        async insert() {
          throw new Error("operational event store unavailable");
        },
      });
      try {
        assert.equal(await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "reconcile"), "repaired");
        await new Promise((r) => setImmediate(r));
        await reconcile.reconcileOrderPayment(ORDER_ID);
      } finally {
        capture.setOperationalEventTestStore(recordingStore);
      }
      assert.equal(state.orders[0].status, "paid");
      assert.equal(db("orders", "PATCH").length, 1);
      assert.equal(historyInserts().length, 1);
      assert.equal(external("graph.facebook.com").length, 1);
      assertNoConfirmationRepeats();
    });

    it("an order an admin already set to paid makes no history insert, so nothing is recorded", async () => {
      incompleteOrder();
      state.orders[0].status = "paid";
      state.failStatusHistoryInsert = true;
      assert.equal(await mark.repairIncompletePaidOrder(createClientForTests(), ORDER_ID, "reconcile"), "repaired");
      await new Promise((r) => setImmediate(r));
      assert.equal(historyInserts().length, 0);
      assert.equal(operationalEvents.length, 0);
      assert.equal(external("graph.facebook.com").length, 1);
    });
  });
});

describe("checkout success page payment states", () => {
  type Collected = { texts: string[]; components: Array<{ name: string; props: Record<string, unknown> }> };

  function collect(node: ReactNode, out: Collected): Collected {
    if (node === null || node === undefined || typeof node === "boolean") return out;
    if (typeof node === "string" || typeof node === "number") {
      out.texts.push(String(node));
      return out;
    }
    if (Array.isArray(node)) {
      for (const child of node) collect(child, out);
      return out;
    }
    const el = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
    const type = el.type as unknown;
    const name = typeof type === "function" ? (type as { name: string }).name : String(type);
    out.components.push({ name, props: el.props });
    collect(el.props?.children, out);
    return out;
  }

  async function render(params: { order?: string; token?: string; payment?: string }) {
    const element = (await successPage.default({ searchParams: Promise.resolve(params) })) as ReactElement;
    const out = collect(element, { texts: [], components: [] });
    return {
      text: out.texts.join(" "),
      has: (name: string) => out.components.some((c) => c.name === name),
      props: (name: string) => out.components.find((c) => c.name === name)?.props,
    };
  }

  const validToken = () => tokens.createOrderAccessToken(ORDER_ID);

  it("a paid payment keeps the existing paid confirmation", async () => {
    state.payments[0].status = "paid";
    Object.assign(state.orders[0], { status: "paid", paid_at: "2026-11-06T10:01:00.000Z" });
    const page = await render({ order: ORDER_ID, token: validToken() });
    assert.match(page.text, /Payment received\. We've sent your confirmation by email and SMS\./);
    assert.equal(page.props("PurchaseTracker")?.state, "paid");
    assert.equal(page.has("CheckoutPaymentPoller"), false);
    assert.equal(page.has("CheckoutSuccessSummary"), true);
  });

  it("a refunded payment shows the refunded state, never paid, with no polling or purchase tracking", async () => {
    state.payments[0].status = "refunded";
    Object.assign(state.orders[0], { status: "refunded", paid_at: "2026-11-05T10:00:00.000Z" });
    const page = await render({ order: ORDER_ID, token: validToken() });
    assert.match(page.text, /This payment has been refunded\./);
    assert.doesNotMatch(page.text, /Payment received/);
    assert.equal(page.has("PurchaseTracker"), false);
    assert.equal(page.has("CheckoutPaymentPoller"), false);
    assert.equal(page.props("CheckoutSuccessClient")?.shouldClearSelected, false);
    assert.equal(external("api.moolre.com").length, 0, "no Moolre call for a refunded payment");
    assert.equal(db("payments", "PATCH").length, 0);
  });

  it("a refunded payment is not shown as paid even with ?payment=success", async () => {
    state.payments[0].status = "refunded";
    Object.assign(state.orders[0], { status: "refunded", paid_at: "2026-11-05T10:00:00.000Z" });
    const page = await render({ order: ORDER_ID, token: validToken(), payment: "success" });
    assert.match(page.text, /refunded/);
    assert.doesNotMatch(page.text, /Payment received/);
  });

  it("a pending payment keeps the existing pending state and poller", async () => {
    state.moolrePaid = false;
    const page = await render({ order: ORDER_ID, token: validToken() });
    assert.match(page.text, /still being confirmed/);
    assert.equal(page.has("CheckoutPaymentPoller"), true);
    assert.equal(page.props("PurchaseTracker")?.state, "pending");
  });

  it("a failed payment keeps the existing failed state", async () => {
    state.payments[0].status = "failed";
    state.moolrePaid = false;
    const page = await render({ order: ORDER_ID, token: validToken() });
    assert.match(page.text, /Payment was not completed/);
    assert.match(page.text, /Try payment again/);
    assert.equal(page.props("PurchaseTracker")?.state, "failed");
  });

  it("invalid and foreign order tokens get no data access and no order details", async () => {
    state.payments[0].status = "refunded";
    for (const token of ["forged.value", tokens.createOrderAccessToken("99999999-2222-3333-4444-555555555555")]) {
      calls.length = 0;
      const page = await render({ order: ORDER_ID, token });
      assert.equal(calls.length, 0, "no database or Moolre access");
      assert.equal(page.has("CheckoutSuccessSummary"), false);
      assert.doesNotMatch(page.text, /OI-20261106-ABC123|customer@example\.com/);
    }
  });
});

/** The same service client the app uses; its requests go to the in-memory fake via global fetch. */
function createClientForTests() {
  return supabaseServer.createServiceRoleClient();
}
