import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildWebsiteHealthSummary,
  filterWebsiteHealthEvents,
  presentWebsiteHealthEvent,
  websiteHealthPayloadLooksSafe,
} from "../lib/website-health/present.ts";
import type { WebsiteHealthEventView } from "../lib/website-health/types.ts";

const root = join(process.cwd());

function event(
  partial: Partial<WebsiteHealthEventView> &
    Pick<WebsiteHealthEventView, "id" | "severity" | "category" | "status">
): WebsiteHealthEventView {
  return {
    id: partial.id,
    incidentId: partial.incidentId ?? `oi_${partial.id}`,
    fingerprint: partial.fingerprint ?? `${partial.category}:webhook:code`,
    severity: partial.severity,
    category: partial.category,
    surface: partial.surface ?? "webhook",
    message: partial.message ?? "Safe operational message",
    metadata: partial.metadata ?? { code: "sample", reason: "verify" },
    occurrenceCount: partial.occurrenceCount ?? 1,
    status: partial.status,
    firstSeenAt: partial.firstSeenAt ?? "2026-08-26T10:00:00.000Z",
    lastSeenAt: partial.lastSeenAt ?? "2026-08-26T12:00:00.000Z",
    resolvedAt: partial.resolvedAt ?? null,
  };
}

describe("superadmin website health presentation reuse", () => {
  it("keeps sanitized events safe for superadmin display", () => {
    const view = presentWebsiteHealthEvent({
      id: "11111111-1111-4111-8111-111111111111",
      incident_id: "oi_sa_abcdef",
      fingerprint: "webhook:webhook:moolre_verify",
      severity: "warning",
      category: "webhook",
      surface: "webhook",
      message: "Moolre webhook signature verification failed",
      metadata: {
        provider: "moolre",
        reason: "verify",
        api_key: "sk_live_should_not_appear",
        email: "customer@example.com",
      },
      occurrence_count: 2,
      status: "open",
      first_seen_at: "2026-08-26T10:00:00.000Z",
      last_seen_at: "2026-08-26T12:00:00.000Z",
      resolved_at: null,
    });
    assert.equal(view.metadata.provider, "moolre");
    assert.equal(view.metadata.reason, "verify");
    assert.equal(view.metadata.api_key, undefined);
    assert.equal(view.metadata.email, undefined);
    assert.equal(websiteHealthPayloadLooksSafe(view), true);
  });

  it("filters and summarizes the same way as admin", () => {
    const events = [
      event({ id: "1", severity: "critical", category: "payment", status: "open", occurrenceCount: 3 }),
      event({ id: "2", severity: "error", category: "auth", status: "resolved" }),
    ];
    const summary = buildWebsiteHealthSummary(events, Date.parse("2026-08-26T12:30:00.000Z"));
    assert.equal(summary.openCount, 1);
    assert.equal(summary.criticalOpenCount, 1);
    assert.equal(summary.totalOccurrencesOpen, 3);
    const open = filterWebsiteHealthEvents(events, {
      status: "open",
      severity: "all",
      category: "all",
      query: "",
    });
    assert.equal(open.length, 1);
  });
});

describe("superadmin website health API and page security", () => {
  it("requires superadmin authorization and is read-only GET", () => {
    const route = readFileSync(join(root, "app/api/superadmin/website-health/route.ts"), "utf8");
    assert.match(route, /getRequestAuthz/);
    assert.match(route, /authz\.isSuperadmin/);
    assert.match(route, /export async function GET/);
    assert.equal(/export async function (POST|PATCH|PUT|DELETE)/.test(route), false);
    assert.match(route, /getWebsiteHealthSnapshot/);
    assert.match(route, /getSuperadminSystemSnapshot/);
    assert.match(route, /platform:\s*\{/);
    assert.equal(/raw_payload|stack_trace|service_role/.test(route), false);
  });

  it("page is read-only and uses dark superadmin panel", () => {
    const page = readFileSync(join(root, "app/superadmin/website-health/page.tsx"), "utf8");
    const panel = readFileSync(join(root, "components/superadmin/website-health-panel.tsx"), "utf8");
    assert.match(page, /SuperadminWebsiteHealthPanel/);
    assert.match(page, /read-only/i);
    assert.match(panel, /Read-only/);
    assert.equal(/\.(update|insert|delete)\(/.test(page), false);
    assert.equal(/fetch\s*\(/.test(panel), false);
    assert.equal(/method:\s*"(POST|PATCH|PUT|DELETE)"/.test(panel), false);
  });

  it("wires Superadmin nav without changing Admin Website Health", () => {
    const nav = readFileSync(join(root, "lib/superadmin/nav.ts"), "utf8");
    assert.match(nav, /\/superadmin\/website-health/);
    assert.match(nav, /Website Health/);
    const adminPage = readFileSync(join(root, "app/admin/website-health/page.tsx"), "utf8");
    assert.match(adminPage, /WebsiteHealthPanel/);
    assert.throws(() =>
      readFileSync(join(root, "app/superadmin/website-health/mutations.ts"), "utf8")
    );
  });

  it("does not alter checkout payment inventory restock capture paths", () => {
    const checkout = readFileSync(join(root, "app/api/checkout/initialize/route.ts"), "utf8");
    const webhook = readFileSync(join(root, "lib/payments/handle-webhook.ts"), "utf8");
    assert.match(checkout, /apiCustomerErrorResponse/);
    assert.match(webhook, /observeOperationalEvent/);
  });
});
