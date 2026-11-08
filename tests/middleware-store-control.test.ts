import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, beforeEach, describe, it } from "node:test";
import type { NextRequest } from "next/server";
import type { StoreBannerRow, StoreSettingsRow } from "../lib/store-control/types.ts";

/**
 * Middleware store-control behaviour against an in-memory PostgREST fake.
 * The fake returns only the columns requested in `select`, like PostgREST.
 */

const EXPECTED_COLUMNS = [
  "store_status",
  "browsing_enabled",
  "checkout_enabled",
  "maintenance_message",
  "private_access_ips",
  "maintenance_use_503",
  "scheduled_activate_at",
  "scheduled_deactivate_at",
  "scheduled_status",
  "revert_status",
];

function fullRow(overrides: Partial<StoreSettingsRow> = {}): StoreSettingsRow {
  return {
    id: 1,
    store_status: "live",
    maintenance_message: null,
    supporting_message: "supporting",
    reopening_date: null,
    presale_date: null,
    launch_date: null,
    banner_text: "Legacy banner",
    banner_enabled: true,
    checkout_enabled: true,
    browsing_enabled: true,
    countdown_enabled: true,
    presale_cta_label: "Join waitlist",
    presale_hero_image_url: null,
    maintenance_hero_image_url: null,
    launch_hero_image_url: null,
    instagram_url: null,
    whatsapp_url: null,
    private_access_password_hash: "secret-hash-should-never-be-read",
    private_access_ips: [],
    scheduled_activate_at: null,
    scheduled_deactivate_at: null,
    scheduled_status: null,
    scheduled_timezone: "Africa/Accra",
    revert_status: "live",
    show_waitlist_count: true,
    maintenance_use_503: false,
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

const banners: StoreBannerRow[] = [
  {
    id: "b1",
    text: "Banner",
    href: null,
    enabled: true,
    starts_at: null,
    ends_at: null,
    sort_order: 0,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
  } as StoreBannerRow,
];

const db = { row: fullRow() as StoreSettingsRow | null, fail: false };
const requests: URL[] = [];

async function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  requests.push(url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "store_settings" && db.fail) {
    return new Response(JSON.stringify({ message: "read timeout" }), { status: 503, headers: { "content-type": "application/json" } });
  }
  if (table === "store_settings") {
    const select = url.searchParams.get("select") ?? "*";
    const cols = select === "*" ? null : select.split(",").map((c) => c.trim());
    const rows = db.row
      ? [cols ? Object.fromEntries(cols.map((c) => [c, (db.row as Record<string, unknown>)[c]])) : db.row]
      : [];
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response(JSON.stringify(table === "store_banners" ? banners : []), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

type EdgeModule = typeof import("../lib/store-control/edge");
type ProxyModule = typeof import("../proxy");
type ResolveModule = typeof import("../lib/store-control/resolve");
type TokenModule = typeof import("../lib/auth/signed-token");
type ServerModule = typeof import("next/server");
let edge: EdgeModule;
let proxyMod: ProxyModule;
let resolve: ResolveModule;
let token: TokenModule;
let server: ServerModule;

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key-for-signing-only";
  // No anon key: updateSession returns NextResponse.next() without a session lookup.
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  globalThis.fetch = fakeFetch as typeof fetch;
  edge = await import("../lib/store-control/edge");
  proxyMod = await import("../proxy");
  resolve = await import("../lib/store-control/resolve");
  token = await import("../lib/auth/signed-token");
  server = await import("next/server");
});

beforeEach(() => {
  db.row = fullRow();
  db.fail = false;
  requests.length = 0;
  edge.invalidateStoreControlEdgeCache();
});

type ProxyRequestInit = { headers?: Record<string, string>; cookie?: string; method?: string };

function req(path: string, init?: ProxyRequestInit): NextRequest {
  const headers = new Headers(init?.headers ?? {});
  if (init?.cookie) headers.set("cookie", init.cookie);
  return new server.NextRequest(`https://oandilabel.com${path}`, { headers, method: init?.method ?? "GET" });
}

type Outcome =
  | { kind: "next" }
  | { kind: "rewrite"; to: string; status: number; retryAfter: string | null }
  | { kind: "redirect"; to: string; status: number }
  | { kind: "json"; status: number; body: Record<string, unknown> };

async function run(path: string, init?: ProxyRequestInit): Promise<Outcome> {
  const res = await proxyMod.proxy(req(path, init));
  const rewrite = res.headers.get("x-middleware-rewrite");
  if (rewrite) {
    return { kind: "rewrite", to: new URL(rewrite).pathname, status: res.status, retryAfter: res.headers.get("retry-after") };
  }
  const location = res.headers.get("location");
  if (location && res.status >= 300 && res.status < 400) {
    return { kind: "redirect", to: new URL(location).pathname, status: res.status };
  }
  if (res.headers.get("x-middleware-next")) return { kind: "next" };
  return { kind: "json", status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function settingsRequests(): URL[] {
  return requests.filter((u) => u.pathname === "/rest/v1/store_settings");
}

describe("middleware store-control query", () => {
  it("selects exactly the ten approved columns and never the password hash", async () => {
    await edge.getStoreControlEdgeCached();
    const [settingsReq] = settingsRequests();
    assert.ok(settingsReq, "store_settings was queried");
    const selected = (settingsReq.searchParams.get("select") ?? "").split(",").map((c) => c.trim());
    assert.deepEqual([...selected].sort(), [...EXPECTED_COLUMNS].sort());
    assert.equal(selected.length, 10);
    assert.ok(!selected.includes("private_access_password_hash"));
    assert.ok(!selected.includes("*"));
    assert.equal(settingsReq.searchParams.get("id"), "eq.1");
  });

  it("makes no store_banners query and only one request per refresh", async () => {
    await edge.getStoreControlEdgeCached();
    assert.equal(requests.filter((u) => u.pathname === "/rest/v1/store_banners").length, 0);
    assert.equal(requests.length, 1);
  });

  it("keeps the 15-second cache: a second call within the window makes no request", async () => {
    await edge.getStoreControlEdgeCached();
    await edge.getStoreControlEdgeCached();
    assert.equal(settingsRequests().length, 1);
  });

  it("falls back to live settings when the row is missing (unchanged behaviour)", async () => {
    db.row = null;
    const { control } = await edge.getStoreControlEdgeCached();
    assert.equal(control.storeStatus, "live");
    assert.equal(control.browsingAllowed, false);
    assert.equal(control.checkoutAllowed, false);
  });
});

describe("decision values match the previous full-row + banners pipeline", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const scenarios: Array<[string, Partial<StoreSettingsRow>]> = [
    ["live", {}],
    ["maintenance", { store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, maintenance_message: "Back soon" }],
    ["maintenance 503", { store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, maintenance_use_503: true }],
    ["presale", { store_status: "presale", browsing_enabled: true, checkout_enabled: false }],
    ["soft close", { store_status: "soft_close", browsing_enabled: true, checkout_enabled: false }],
    ["private access", { store_status: "private_access", browsing_enabled: true, checkout_enabled: true, private_access_ips: ["203.0.113.7"] }],
    ["pre-launch", { store_status: "pre_launch", browsing_enabled: false, checkout_enabled: false }],
    ["holiday", { store_status: "holiday_break", browsing_enabled: false, checkout_enabled: false }],
    ["inventory", { store_status: "inventory_update", browsing_enabled: false, checkout_enabled: false }],
    ["scheduled activation due", { scheduled_activate_at: past, scheduled_status: "maintenance" }],
    ["scheduled activation not due", { scheduled_activate_at: future, scheduled_status: "maintenance" }],
    ["scheduled deactivation due", { store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, scheduled_deactivate_at: past, revert_status: "live" }],
  ];

  for (const [name, overrides] of scenarios) {
    it(name, async () => {
      db.row = fullRow(overrides);
      const { control, settings } = await edge.getStoreControlEdgeCached();

      const referenceSettings = resolve.applyScheduledTransitions(fullRow(overrides)).settings;
      const reference = resolve.resolveEffectiveStoreControl(referenceSettings, banners);

      for (const key of [
        "storeStatus",
        "browsingAllowed",
        "checkoutAllowed",
        "maintenanceMessage",
        "closedPageSlug",
        "requiresPrivateAccess",
        "softCloseMode",
        "isLive",
      ] as const) {
        assert.deepEqual(control[key], reference[key], `control.${key}`);
      }
      assert.deepEqual(settings.private_access_ips, referenceSettings.private_access_ips);
      assert.equal(settings.maintenance_use_503, referenceSettings.maintenance_use_503);
      assert.equal(settings.private_access_password_hash, null, "secret is not loaded");
    });
  }
});

describe("middleware access decisions (proxy)", () => {
  it("live store: storefront, checkout and checkout API pass through", async () => {
    assert.deepEqual(await run("/shop"), { kind: "next" });
    assert.deepEqual(await run("/checkout"), { kind: "next" });
    assert.deepEqual(await run("/api/checkout/initialize"), { kind: "next" });
  });

  it("always-allowed paths bypass store control without querying settings", async () => {
    db.row = fullRow({ store_status: "maintenance", browsing_enabled: false, checkout_enabled: false });
    for (const path of ["/admin", "/superadmin", "/api/webhooks/moolre", "/auth/callback", "/closed/maintenance"]) {
      assert.deepEqual(await run(path), { kind: "next" }, path);
    }
    assert.equal(settingsRequests().length, 0);
  });

  it("maintenance: storefront rewrites to the closed page with Retry-After", async () => {
    db.row = fullRow({ store_status: "maintenance", browsing_enabled: false, checkout_enabled: false });
    assert.deepEqual(await run("/shop"), { kind: "rewrite", to: "/closed/maintenance", status: 200, retryAfter: "3600" });
    assert.deepEqual(await run("/"), { kind: "rewrite", to: "/closed/maintenance", status: 200, retryAfter: "3600" });
  });

  it("maintenance with 503 enabled returns a 503 closed page", async () => {
    db.row = fullRow({ store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, maintenance_use_503: true });
    const res = await proxyMod.proxy(req("/shop"));
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("retry-after"), "3600");
  });

  it("checkout API is blocked with the maintenance message when checkout is disabled", async () => {
    db.row = fullRow({ store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, maintenance_message: "Back soon" });
    assert.deepEqual(await run("/api/checkout/initialize"), {
      kind: "json",
      status: 503,
      body: { error: "Back soon", code: "store_checkout_disabled" },
    });
  });

  it("presale: browsing allowed, checkout rewritten to the presale page", async () => {
    db.row = fullRow({ store_status: "presale", browsing_enabled: true, checkout_enabled: false });
    assert.deepEqual(await run("/shop"), { kind: "next" });
    assert.deepEqual(await run("/checkout"), { kind: "rewrite", to: "/closed/presale", status: 200, retryAfter: null });
    const api = await run("/api/checkout/initialize");
    assert.equal(api.kind, "json");
    assert.equal((api as { status: number }).status, 503);
  });

  it("soft close: checkout and cart redirect home, browsing allowed", async () => {
    db.row = fullRow({ store_status: "soft_close", browsing_enabled: true, checkout_enabled: false });
    assert.deepEqual(await run("/shop"), { kind: "next" });
    assert.deepEqual(await run("/checkout"), { kind: "redirect", to: "/", status: 307 });
    assert.deepEqual(await run("/cart"), { kind: "redirect", to: "/", status: 307 });
  });

  it("other closed statuses rewrite to their closed pages", async () => {
    const cases: Array<[StoreSettingsRow["store_status"], string]> = [
      ["pre_launch", "/closed/pre-launch"],
      ["holiday_break", "/closed/holiday"],
      ["inventory_update", "/closed/inventory"],
    ];
    for (const [status, slug] of cases) {
      db.row = fullRow({ store_status: status, browsing_enabled: false, checkout_enabled: false });
      edge.invalidateStoreControlEdgeCache();
      assert.deepEqual(await run("/product/x"), { kind: "rewrite", to: slug, status: 200, retryAfter: "3600" }, status);
    }
  });

  it("private access: blocked without credentials", async () => {
    db.row = fullRow({ store_status: "private_access", browsing_enabled: true, checkout_enabled: true });
    assert.deepEqual(await run("/shop"), { kind: "rewrite", to: "/closed/private-access", status: 200, retryAfter: "3600" });
  });

  it("private access: allowed with a valid signed access cookie, blocked with an invalid one", async () => {
    db.row = fullRow({ store_status: "private_access", browsing_enabled: true, checkout_enabled: true });
    const valid = token.createStoreAccessToken(60 * 60 * 24 * 7);
    assert.deepEqual(await run("/shop", { cookie: `oi_store_access=${valid}` }), { kind: "next" });
    assert.deepEqual(await run("/shop", { cookie: "oi_store_access=forged.value" }), {
      kind: "rewrite",
      to: "/closed/private-access",
      status: 200,
      retryAfter: "3600",
    });
  });

  it("private access: IP allow-list is honoured; other IPs are blocked", async () => {
    db.row = fullRow({ store_status: "private_access", browsing_enabled: true, checkout_enabled: true, private_access_ips: ["203.0.113.7"] });
    assert.deepEqual(await run("/shop", { headers: { "x-vercel-forwarded-for": "203.0.113.7" } }), { kind: "next" });
    assert.deepEqual(await run("/shop", { headers: { "x-vercel-forwarded-for": "198.51.100.1" } }), {
      kind: "rewrite",
      to: "/closed/private-access",
      status: 200,
      retryAfter: "3600",
    });
  });

  it("scheduled activation due is enforced in memory (without persisting)", async () => {
    db.row = fullRow({
      scheduled_activate_at: new Date(Date.now() - 60_000).toISOString(),
      scheduled_status: "maintenance",
    });
    assert.deepEqual(await run("/shop"), { kind: "rewrite", to: "/closed/maintenance", status: 200, retryAfter: "3600" });
    assert.ok(requests.every((u) => u.pathname === "/rest/v1/store_settings"), "read-only: no writes issued");
  });

  it("scheduled deactivation due reopens the store", async () => {
    db.row = fullRow({
      store_status: "maintenance",
      browsing_enabled: false,
      checkout_enabled: false,
      scheduled_deactivate_at: new Date(Date.now() - 60_000).toISOString(),
      revert_status: "live",
    });
    assert.deepEqual(await run("/shop"), { kind: "next" });
  });
});

describe("existing-payment access: payment-status poll and checkout success page", () => {
  const SUCCESS = "/checkout/success?order=11111111-2222-3333-4444-555555555555&token=signed";
  const checkoutBlocked = { kind: "json", status: 503 } as const;

  async function status(path: string, init?: ProxyRequestInit): Promise<{ kind: string; status?: number }> {
    const outcome = await run(path, init);
    return outcome.kind === "json" ? { kind: "json", status: outcome.status } : { kind: outcome.kind };
  }

  const checkoutOff: Array<[string, Partial<StoreSettingsRow>]> = [
    ["presale", { store_status: "presale", browsing_enabled: true, checkout_enabled: false }],
    ["soft close", { store_status: "soft_close", browsing_enabled: true, checkout_enabled: false }],
    ["maintenance", { store_status: "maintenance", browsing_enabled: false, checkout_enabled: false }],
    ["checkout toggled off while live", { store_status: "live", browsing_enabled: true, checkout_enabled: false }],
  ];

  for (const [name, overrides] of checkoutOff) {
    it(`A. checkout disabled (${name}): only GET payment-status passes; other checkout APIs stay blocked`, async () => {
      db.row = fullRow(overrides);
      assert.deepEqual(await run("/api/checkout/payment-status?order=x&token=y"), { kind: "next" });
      assert.deepEqual(await status("/api/checkout/payment-status", { method: "POST" }), checkoutBlocked);
      assert.deepEqual(await status("/api/checkout/payment-status", { method: "HEAD" }), checkoutBlocked);
      assert.deepEqual(await status("/api/checkout/initialize", { method: "POST" }), checkoutBlocked);
      assert.deepEqual(await status("/api/checkout/initialize"), checkoutBlocked);
      assert.deepEqual(await status("/api/checkout/validate-discount", { method: "POST" }), checkoutBlocked);
      assert.deepEqual(await status("/api/checkout/payment-status/extra"), checkoutBlocked);
      assert.deepEqual(await status("/api/checkout/payment-status/"), checkoutBlocked);
    });
  }

  for (const [status_, slug] of [
    ["maintenance", "/closed/maintenance"],
    ["pre_launch", "/closed/pre-launch"],
    ["holiday_break", "/closed/holiday"],
  ] as Array<[StoreSettingsRow["store_status"], string]>) {
    it(`B. browsing disabled (${status_}): exact /checkout/success passes; everything else is rewritten as before`, async () => {
      db.row = fullRow({ store_status: status_, browsing_enabled: false, checkout_enabled: false });
      assert.deepEqual(await run(SUCCESS), { kind: "next" });
      assert.deepEqual(await run("/checkout/success"), { kind: "next" });
      for (const path of ["/shop", "/", "/checkout", "/checkout/review", "/checkout/success/extra", "/cart"]) {
        assert.deepEqual(await run(path), { kind: "rewrite", to: slug, status: 200, retryAfter: "3600" }, path);
      }
    });
  }

  it("C. checkout disabled, browsing enabled (presale): success page passes; other checkout pages stay restricted", async () => {
    db.row = fullRow({ store_status: "presale", browsing_enabled: true, checkout_enabled: false });
    assert.deepEqual(await run(SUCCESS), { kind: "next" });
    assert.deepEqual(await run("/checkout"), { kind: "rewrite", to: "/closed/presale", status: 200, retryAfter: null });
    assert.deepEqual(await run("/checkout/review"), { kind: "rewrite", to: "/closed/presale", status: 200, retryAfter: null });
    assert.deepEqual(await run("/checkout/success/extra"), { kind: "rewrite", to: "/closed/presale", status: 200, retryAfter: null });
    assert.deepEqual(await run("/shop"), { kind: "next" });
  });

  it("D. soft close: success page is not redirected; other checkout pages and cart keep their redirect", async () => {
    db.row = fullRow({ store_status: "soft_close", browsing_enabled: true, checkout_enabled: false });
    assert.deepEqual(await run(SUCCESS), { kind: "next" });
    assert.deepEqual(await run("/checkout"), { kind: "redirect", to: "/", status: 307 });
    assert.deepEqual(await run("/checkout/review"), { kind: "redirect", to: "/", status: 307 });
    assert.deepEqual(await run("/cart"), { kind: "redirect", to: "/", status: 307 });
  });

  for (const checkoutEnabled of [true, false]) {
    it(`E. private access (checkout ${checkoutEnabled ? "on" : "off"}): success page still needs private-access credentials`, async () => {
      db.row = fullRow({
        store_status: "private_access",
        browsing_enabled: true,
        checkout_enabled: checkoutEnabled,
        private_access_ips: ["203.0.113.7"],
      });
      const blocked = { kind: "rewrite", to: "/closed/private-access", status: 200, retryAfter: "3600" };
      assert.deepEqual(await run(SUCCESS), blocked);
      assert.deepEqual(await run(SUCCESS, { cookie: "oi_store_access=forged.value" }), blocked);
      const valid = token.createStoreAccessToken(60 * 60 * 24 * 7);
      assert.deepEqual(await run(SUCCESS, { cookie: `oi_store_access=${valid}` }), { kind: "next" });
      assert.deepEqual(await run(SUCCESS, { headers: { "x-vercel-forwarded-for": "203.0.113.7" } }), { kind: "next" });
    });
  }

  it("F. store-state read failure: success page and GET payment-status stay reachable; everything else fails closed", async () => {
    db.fail = true;
    assert.deepEqual(await run(SUCCESS), { kind: "next" });
    assert.deepEqual(await run("/api/checkout/payment-status?order=x&token=y"), { kind: "next" });
    for (const path of ["/shop", "/", "/checkout", "/checkout/review"]) {
      assert.deepEqual(await run(path), { kind: "rewrite", to: "/closed/maintenance", status: 200, retryAfter: "3600" }, path);
    }
    assert.deepEqual(await status("/api/checkout/initialize", { method: "POST" }), checkoutBlocked);
    assert.deepEqual(await status("/api/checkout/validate-discount", { method: "POST" }), checkoutBlocked);
    assert.deepEqual(await status("/api/checkout/payment-status", { method: "POST" }), checkoutBlocked);
  });

  it("G. checkout enabled: behaviour unchanged for checkout pages and APIs", async () => {
    for (const path of [SUCCESS, "/checkout", "/checkout/review", "/shop"]) {
      assert.deepEqual(await run(path), { kind: "next" }, path);
    }
    for (const [path, method] of [
      ["/api/checkout/payment-status", "GET"],
      ["/api/checkout/payment-status", "POST"],
      ["/api/checkout/initialize", "POST"],
      ["/api/checkout/validate-discount", "POST"],
    ]) {
      assert.deepEqual(await run(path, { method }), { kind: "next" }, `${method} ${path}`);
    }
  });

  it("path helpers match only the exact path and method", async () => {
    const paths = await import("../lib/store-control/paths");
    assert.equal(paths.isPaymentStatusPoll("/api/checkout/payment-status", "GET"), true);
    for (const [p, m] of [
      ["/api/checkout/payment-status", "POST"],
      ["/api/checkout/payment-status", "HEAD"],
      ["/api/checkout/payment-status", "get"],
      ["/api/checkout/payment-status/", "GET"],
      ["/api/checkout/payment-status/extra", "GET"],
      ["/api/checkout/initialize", "GET"],
      ["/api/checkout", "GET"],
    ]) {
      assert.equal(paths.isPaymentStatusPoll(p, m), false, `${m} ${p}`);
    }
    assert.equal(paths.isCheckoutSuccessPath("/checkout/success"), true);
    for (const p of ["/checkout", "/checkout/success/", "/checkout/success/extra", "/checkout/successful", "/Checkout/success"]) {
      assert.equal(paths.isCheckoutSuccessPath(p), false, p);
    }
  });
});

describe("store-control reads only for paths that use them", () => {
  const STORE_STATES: Array<[string, Partial<StoreSettingsRow>]> = [
    ["live", {}],
    ["presale", { store_status: "presale", browsing_enabled: true, checkout_enabled: false }],
    ["maintenance", { store_status: "maintenance", browsing_enabled: false, checkout_enabled: false }],
    ["maintenance 503", { store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, maintenance_use_503: true }],
    ["private access", { store_status: "private_access", browsing_enabled: true, checkout_enabled: true }],
    ["soft close", { store_status: "soft_close", browsing_enabled: true, checkout_enabled: false }],
  ];

  /** Paths whose decisions read store control: storefront pages (including cart and checkout) and the checkout API. */
  const STORE_CONTROL_PATHS = [
    "/",
    "/shop",
    "/shop/dresses",
    "/product/silk-dress",
    "/cart",
    "/checkout",
    "/checkout/success",
    "/account",
    "/blog",
    "/about",
    "/contact",
    "/track-order",
    "/policies/terms",
    "/login",
    "/signup",
    "/api/checkout/initialize",
    "/api/checkout/validate-discount",
    "/api/checkout/payment-status",
  ];

  /** Paths that never used a store-control decision. */
  const UNRELATED_PATHS = [
    "/robots.txt",
    "/sitemap.xml",
    "/api/reviews",
    "/api/reviews/eligible",
    "/api/reviews/upload",
    "/api/track-order",
    "/api/restock-notifications/subscribe",
    "/api/restock-notifications/unsubscribe",
    "/api/cron/reconcile-payments",
    "/forgot-password",
    "/reset-password",
    "/wp-login.php",
    "/xmlrpc.php",
    "/.env",
    "/.git/config",
    "/phpmyadmin/index.php",
    "/apple-touch-icon-precomposed.png",
    "/shopping",
    "/cartography",
    "/checkoutx",
    "/accounts",
    "/products/x",
  ];

  it("storefront, cart, checkout and checkout-API requests still read store control", async () => {
    for (const path of STORE_CONTROL_PATHS) {
      edge.invalidateStoreControlEdgeCache();
      requests.length = 0;
      await run(path);
      assert.equal(settingsRequests().length, 1, `${path} reads store control`);
    }
  });

  for (const [state, overrides] of STORE_STATES) {
    it(`${state}: unrelated, crawler and probe paths pass through without reading store control`, async () => {
      db.row = fullRow(overrides);
      for (const path of UNRELATED_PATHS) {
        for (const method of ["GET", "POST", "HEAD"]) {
          assert.deepEqual(await run(path, { method }), { kind: "next" }, `${method} ${path}`);
        }
      }
      assert.equal(settingsRequests().length, 0, "no store_settings request for any unrelated path");
      assert.equal(requests.length, 0, "no Supabase request of any kind");
    });
  }

  it("unrelated paths cannot reach the reader even when the store-state read would fail", async () => {
    db.fail = true;
    for (const path of UNRELATED_PATHS) {
      assert.deepEqual(await run(path), { kind: "next" }, path);
    }
    assert.equal(settingsRequests().length, 0);
  });

  it("the 15-second cache still serves repeated storefront requests with one read", async () => {
    for (const path of ["/shop", "/product/x", "/checkout", "/api/checkout/initialize", "/robots.txt", "/shop"]) {
      await run(path);
    }
    assert.equal(settingsRequests().length, 1);
  });

  it("restrictions still apply on storefront and checkout paths in every closed state", async () => {
    db.row = fullRow({ store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, maintenance_message: "Back soon" });
    assert.deepEqual(await run("/shop"), { kind: "rewrite", to: "/closed/maintenance", status: 200, retryAfter: "3600" });
    assert.deepEqual(await run("/api/checkout/initialize", { method: "POST" }), {
      kind: "json",
      status: 503,
      body: { error: "Back soon", code: "store_checkout_disabled" },
    });
    edge.invalidateStoreControlEdgeCache();
    db.row = fullRow({ store_status: "private_access", browsing_enabled: true, checkout_enabled: true });
    assert.deepEqual(await run("/product/x"), { kind: "rewrite", to: "/closed/private-access", status: 200, retryAfter: "3600" });
    assert.deepEqual(await run("/cart"), { kind: "rewrite", to: "/closed/private-access", status: 200, retryAfter: "3600" });
  });

  it("always-allowed paths are unchanged and read nothing", async () => {
    db.row = fullRow({ store_status: "maintenance", browsing_enabled: false, checkout_enabled: false });
    for (const path of [
      "/admin",
      "/admin/products",
      "/superadmin",
      "/api/admin/products",
      "/api/superadmin/site-settings",
      "/api/webhooks/moolre",
      "/api/newsletter/subscribe",
      "/api/store-control/waitlist",
      "/api/auth/anything",
      "/auth/callback",
      "/closed/maintenance",
      "/maintenance",
    ]) {
      assert.deepEqual(await run(path), { kind: "next" }, path);
    }
    assert.equal(settingsRequests().length, 0);
  });

  it("updateSession still runs (one Auth check for a signed-in visitor) on every kind of path", async () => {
    const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
    const session = {
      access_token: "visitor-token",
      refresh_token: "visitor-refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "visitor", email: "visitor@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
    };
    const cookie = `sb-unit-test-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
    const authChecks = () => requests.filter((u) => u.pathname === "/auth/v1/user").length;
    try {
      for (const path of ["/shop", "/api/checkout/initialize", "/robots.txt", "/sitemap.xml", "/api/reviews", "/wp-login.php", "/admin"]) {
        requests.length = 0;
        await run(path, { cookie });
        assert.equal(authChecks(), 1, `${path} runs updateSession`);
      }
    } finally {
      if (previousAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    }
  });

  it("the gate uses the existing path helpers and sits before the store-control read", () => {
    const source = readFileSync("proxy.ts", "utf8");
    const gate = source.indexOf("if (!isStorefrontPath(pathname) && !isCheckoutApiPath(pathname)) {");
    const read = source.indexOf("await getStoreControlEdgeCached()");
    assert.ok(gate > 0 && read > gate, "gate precedes the read");
    assert.equal(source.match(/getStoreControlEdgeCached\(\)/g)?.length, 1, "single read site");
    assert.match(source, /matcher: \[\s*"\/\(\(\?!_next\/static\|_next\/image\|favicon\.ico\|\.\*\\\\\.\(\?:svg\|png\|jpg\|jpeg\|gif\|webp\)\$\)\.\*\)",\s*\]/);
  });
});
