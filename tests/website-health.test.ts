import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildWebsiteHealthSummary,
  filterWebsiteHealthEvents,
  presentOperationalMetadata,
  presentWebsiteHealthEvent,
  websiteHealthPayloadLooksSafe,
} from "../lib/website-health/present.ts";
import type { WebsiteHealthEventView } from "../lib/website-health/types.ts";

const root = join(process.cwd());

function event(
  partial: Partial<WebsiteHealthEventView> & Pick<WebsiteHealthEventView, "id" | "severity" | "category" | "status">
): WebsiteHealthEventView {
  return {
    id: partial.id,
    incidentId: partial.incidentId ?? `oi_${partial.id}`,
    fingerprint: partial.fingerprint ?? `${partial.category}:storefront:code`,
    severity: partial.severity,
    category: partial.category,
    surface: partial.surface ?? "storefront",
    message: partial.message ?? "Safe operational message",
    metadata: partial.metadata ?? { code: "sample" },
    occurrenceCount: partial.occurrenceCount ?? 1,
    status: partial.status,
    firstSeenAt: partial.firstSeenAt ?? "2026-08-26T10:00:00.000Z",
    lastSeenAt: partial.lastSeenAt ?? "2026-08-26T12:00:00.000Z",
    resolvedAt: partial.resolvedAt ?? null,
  };
}

describe("presentOperationalMetadata", () => {
  it("keeps only allowlisted keys and redacts secrets", () => {
    const meta = presentOperationalMetadata({
      code: "payment_init",
      reason: "amount_mismatch",
      purpose: "order_confirmation",
      outcome: "failed",
      http_status: 502,
      operation: "checkout_payment",
      provider: "moolre",
      provider_error_class: "ResendError",
      latest_incident_id: "oi_abc_123456",
      api_key: "re_secret",
      email: "buyer@example.com",
      html: "<p>body</p>",
      webhook_secret: "whsec_x",
      stack: "Error at foo",
      raw_payload: { a: 1 },
    });
    assert.equal(meta.code, "payment_init");
    assert.equal(meta.reason, "amount_mismatch");
    assert.equal(meta.http_status, 502);
    assert.equal(meta.api_key, undefined);
    assert.equal(meta.email, undefined);
    assert.equal(meta.html, undefined);
    assert.equal(meta.webhook_secret, undefined);
    assert.equal(meta.stack, undefined);
    assert.equal(meta.raw_payload, undefined);
    assert.equal(websiteHealthPayloadLooksSafe(meta), true);
  });
});

describe("presentWebsiteHealthEvent", () => {
  it("sanitizes message and strips unsafe metadata", () => {
    const view = presentWebsiteHealthEvent({
      id: "11111111-1111-4111-8111-111111111111",
      incident_id: "oi_test_abcdef",
      fingerprint: "payment:storefront:payment_init",
      severity: "critical",
      category: "payment",
      surface: "storefront",
      message: "Failed for buyer@example.com order 22222222-2222-4222-8222-222222222222",
      metadata: {
        code: "payment_init",
        api_key: "sk_live_abc",
        to: "buyer@example.com",
      },
      occurrence_count: 3,
      status: "open",
      first_seen_at: "2026-08-26T10:00:00.000Z",
      last_seen_at: "2026-08-26T12:00:00.000Z",
      resolved_at: null,
    });
    assert.equal(view.message.includes("buyer@"), false);
    assert.equal(view.message.includes("22222222"), false);
    assert.equal(view.metadata.code, "payment_init");
    assert.equal(view.metadata.api_key, undefined);
    assert.equal(view.metadata.to, undefined);
    assert.equal(view.occurrenceCount, 3);
    assert.equal(websiteHealthPayloadLooksSafe(view), true);
  });
});

describe("buildWebsiteHealthSummary", () => {
  it("counts open severities and 24h activity", () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const events = [
      event({
        id: "1",
        severity: "critical",
        category: "payment",
        status: "open",
        occurrenceCount: 4,
        lastSeenAt: "2026-08-26T11:30:00.000Z",
      }),
      event({
        id: "2",
        severity: "error",
        category: "email",
        status: "open",
        occurrenceCount: 2,
        lastSeenAt: "2026-08-26T11:00:00.000Z",
      }),
      event({
        id: "3",
        severity: "warning",
        category: "webhook",
        status: "resolved",
        lastSeenAt: "2026-08-20T11:00:00.000Z",
      }),
    ];
    const summary = buildWebsiteHealthSummary(events, now);
    assert.equal(summary.openCount, 2);
    assert.equal(summary.criticalOpenCount, 1);
    assert.equal(summary.errorOpenCount, 1);
    assert.equal(summary.warningOpenCount, 0);
    assert.equal(summary.activeLast24hCount, 2);
    assert.equal(summary.totalOccurrencesOpen, 6);
    assert.deepEqual(summary.byCategory, [
      { category: "email", count: 1 },
      { category: "payment", count: 1 },
    ]);
  });
});

describe("filterWebsiteHealthEvents", () => {
  it("filters by status severity category and query", () => {
    const events = [
      event({
        id: "a",
        severity: "critical",
        category: "payment",
        status: "open",
        message: "Payment init failed",
        fingerprint: "payment:storefront:payment_init",
        incidentId: "oi_pay_aaaaaa",
      }),
      event({
        id: "b",
        severity: "error",
        category: "auth",
        status: "open",
        message: "Auth exchange failed",
      }),
      event({
        id: "c",
        severity: "warning",
        category: "webhook",
        status: "resolved",
        message: "Signature verify failed",
      }),
    ];

    const openOnly = filterWebsiteHealthEvents(events, {
      status: "open",
      severity: "all",
      category: "all",
      query: "",
    });
    assert.equal(openOnly.length, 2);
    assert.equal(openOnly[0]?.severity, "critical");

    const payment = filterWebsiteHealthEvents(events, {
      status: "all",
      severity: "all",
      category: "payment",
      query: "",
    });
    assert.equal(payment.length, 1);

    const searched = filterWebsiteHealthEvents(events, {
      status: "all",
      severity: "all",
      category: "all",
      query: "oi_pay",
    });
    assert.equal(searched.length, 1);
    assert.equal(searched[0]?.id, "a");
  });
});

describe("admin website health API and page security", () => {
  it("requires admin authorization and is read-only GET", () => {
    const route = readFileSync(join(root, "app/api/admin/website-health/route.ts"), "utf8");
    assert.match(route, /getRequestAuthz/);
    assert.match(route, /authz\.isAdmin/);
    assert.match(route, /export async function GET/);
    assert.equal(/export async function (POST|PATCH|PUT|DELETE)/.test(route), false);
    assert.equal(route.includes("acknowledged_by"), false);
  });

  it("page and store avoid mutation and unsafe columns", () => {
    const page = readFileSync(join(root, "app/admin/website-health/page.tsx"), "utf8");
    const store = readFileSync(join(root, "lib/website-health/store.ts"), "utf8");
    const panel = readFileSync(join(root, "components/admin/website-health-panel.tsx"), "utf8");
    assert.match(page, /WebsiteHealthPanel/);
    assert.match(store, /operational_events/);
    assert.match(store, /SELECT_COLUMNS/);
    assert.equal(store.includes(".select(SELECT_COLUMNS)"), true);
    assert.equal(/\.(update|insert|delete)\(/.test(store), false);
    assert.match(panel, /Read-only/);
    assert.equal(/fetch\s*\(/.test(panel), false);
  });

  it("wires Admin System nav without touching Superadmin", () => {
    const sidebar = readFileSync(join(root, "components/admin/admin-sidebar.tsx"), "utf8");
    const topbar = readFileSync(join(root, "components/admin/admin-topbar.tsx"), "utf8");
    assert.match(sidebar, /\/admin\/website-health/);
    assert.match(sidebar, /Website Health/);
    assert.match(topbar, /\/admin\/website-health/);
    assert.throws(() => readFileSync(join(root, "app/superadmin/website-health/page.tsx"), "utf8"));
  });

  it("does not modify checkout payment inventory restock capture paths", () => {
    const checkout = readFileSync(join(root, "app/api/checkout/initialize/route.ts"), "utf8");
    const webhook = readFileSync(join(root, "lib/payments/handle-webhook.ts"), "utf8");
    const markPaid = readFileSync(join(root, "lib/payments/mark-order-paid.ts"), "utf8");
    // Sanity: Phase 4C hooks remain; Phase 4D did not remove them or add UI mutations there.
    assert.match(checkout, /apiCustomerErrorResponse/);
    assert.match(webhook, /observeOperationalEvent/);
    assert.match(markPaid, /inventory_error/);
  });
});
