import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { before, beforeEach, describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { StoreSettingsRow } from "../lib/store-control/types.ts";

/**
 * The waitlist count is only queried where it can be displayed. Supabase is an
 * in-memory PostgREST fake (global fetch); nothing touches a real database.
 */

const LAUNCH = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();

function settingsRow(overrides: Partial<StoreSettingsRow> = {}): StoreSettingsRow {
  return {
    id: 1,
    store_status: "live",
    maintenance_message: null,
    supporting_message: null,
    reopening_date: null,
    presale_date: null,
    launch_date: null,
    banner_text: null,
    banner_enabled: false,
    checkout_enabled: true,
    browsing_enabled: true,
    countdown_enabled: false,
    presale_cta_label: "Join waitlist",
    presale_hero_image_url: null,
    maintenance_hero_image_url: null,
    launch_hero_image_url: null,
    instagram_url: null,
    whatsapp_url: null,
    private_access_password_hash: null,
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

const presaleWithCountdown: Partial<StoreSettingsRow> = {
  store_status: "presale",
  browsing_enabled: true,
  checkout_enabled: false,
  countdown_enabled: true,
  launch_date: LAUNCH,
};

const db = { settings: settingsRow(), waitlistTotal: 0 };
const requests: { table: string; method: string }[] = [];
const cacheStore = new Map<string, unknown>();

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const table = url.pathname.replace("/rest/v1/", "");
  requests.push({ table, method });
  if (method !== "GET" && method !== "HEAD") return json([]);
  if (table === "store_settings") return json([db.settings]);
  if (table === "store_waitlist") {
    return new Response(null, { status: 200, headers: { "content-range": `*/${db.waitlistTotal}` } });
  }
  return json([]);
}

const fakeIncrementalCache = {
  isOnDemandRevalidate: false,
  async generateCacheKey(key: string) {
    return key;
  },
  async get(key: string) {
    return cacheStore.has(key) ? { isStale: false, value: cacheStore.get(key) } : null;
  },
  async set(key: string, data: unknown) {
    cacheStore.set(key, data);
  },
};

function waitlistQueries(): number {
  return requests.filter((r) => r.table === "store_waitlist").length;
}

type ServerModule = typeof import("../lib/store-control/server");
type DisplayModule = typeof import("../lib/store-control/waitlist-display");
type ProviderModule = typeof import("../components/store-control/store-control-provider");
type StripModule = typeof import("../components/store-control/presale-strip");
type ClosedPageModule = typeof import("../app/closed/[slug]/page");
let server: ServerModule;
let display: DisplayModule;
let provider: ProviderModule;
let strip: StripModule;
let closedPage: ClosedPageModule;

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;
  server = await import("../lib/store-control/server");
  display = await import("../lib/store-control/waitlist-display");
  provider = await import("../components/store-control/store-control-provider");
  strip = await import("../components/store-control/presale-strip");
  closedPage = await import("../app/closed/[slug]/page");
});

beforeEach(() => {
  db.settings = settingsRow();
  db.waitlistTotal = 0;
  requests.length = 0;
  cacheStore.clear();
});

/** What the storefront layout does: load control, then render the presale strip. */
async function storefront(): Promise<{ html: string; waitlistCount: number }> {
  const control = await server.getEffectiveStoreControl({
    includeWaitlistCount: display.storefrontShowsWaitlistCount,
  });
  const html = renderToStaticMarkup(
    provider.StoreControlProvider({ control, children: createElement(strip.PresaleLaunchStrip) })
  );
  return { html, waitlistCount: control.waitlistCount };
}

async function renderClosed(slug: string): Promise<string> {
  const element = (await closedPage.default({ params: Promise.resolve({ slug }) })) as ReactElement;
  return renderToStaticMarkup(element);
}

describe("storefront layout waitlist count", () => {
  for (const [name, overrides] of [
    ["live", {}],
    ["maintenance", { store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, countdown_enabled: true, reopening_date: LAUNCH }],
    ["soft close", { store_status: "soft_close", browsing_enabled: true, checkout_enabled: false, countdown_enabled: true, launch_date: LAUNCH }],
    ["pre-launch", { store_status: "pre_launch", browsing_enabled: false, checkout_enabled: false, countdown_enabled: true, launch_date: LAUNCH }],
    ["private access", { store_status: "private_access", countdown_enabled: true, launch_date: LAUNCH }],
  ] as Array<[string, Partial<StoreSettingsRow>]>) {
    it(`${name}: does not query the waitlist`, async () => {
      db.settings = settingsRow(overrides);
      db.waitlistTotal = 42;
      const { html, waitlistCount } = await storefront();
      assert.equal(waitlistQueries(), 0);
      assert.equal(waitlistCount, 0);
      assert.ok(!html.includes("subscribers"));
    });
  }

  it("presale with countdown and showWaitlistCount: queries once and displays the exact count", async () => {
    db.settings = settingsRow(presaleWithCountdown);
    db.waitlistTotal = 1234;
    const { html, waitlistCount } = await storefront();
    assert.equal(waitlistQueries(), 1);
    assert.equal(waitlistCount, 1234);
    assert.ok(html.includes(`Join ${(1234).toLocaleString()} subscribers waiting for launch`));
  });

  it("presale with a zero count: queries but keeps the count hidden", async () => {
    db.settings = settingsRow(presaleWithCountdown);
    db.waitlistTotal = 0;
    const { html } = await storefront();
    assert.equal(waitlistQueries(), 1);
    assert.ok(html.includes("Presale preview"), "strip still renders");
    assert.ok(!html.includes("subscribers"));
  });

  for (const [name, overrides] of [
    ["showWaitlistCount off", { show_waitlist_count: false }],
    ["countdown disabled", { countdown_enabled: false }],
    ["countdown enabled without a target date", { launch_date: null }],
  ] as Array<[string, Partial<StoreSettingsRow>]>) {
    it(`presale with ${name}: does not query the waitlist`, async () => {
      db.settings = settingsRow({ ...presaleWithCountdown, ...overrides });
      db.waitlistTotal = 42;
      const { html } = await storefront();
      assert.equal(waitlistQueries(), 0);
      assert.ok(!html.includes("subscribers"));
    });
  }

  it("uses the effective status after a due scheduled transition into presale", async () => {
    db.settings = settingsRow({
      countdown_enabled: true,
      launch_date: LAUNCH,
      scheduled_activate_at: new Date(Date.now() - 60_000).toISOString(),
      scheduled_status: "presale",
    });
    db.waitlistTotal = 9;
    const { html } = await storefront();
    assert.equal(waitlistQueries(), 1);
    assert.ok(html.includes("Join 9 subscribers waiting for launch"));
  });

  it("uses the effective status after a due scheduled transition out of presale", async () => {
    db.settings = settingsRow({
      ...presaleWithCountdown,
      scheduled_deactivate_at: new Date(Date.now() - 60_000).toISOString(),
      revert_status: "live",
    });
    db.waitlistTotal = 9;
    await storefront();
    assert.equal(waitlistQueries(), 0);
  });
});

describe("closed page waitlist count", () => {
  it("metadata never queries the waitlist", async () => {
    db.settings = settingsRow({ ...presaleWithCountdown });
    db.waitlistTotal = 5;
    await closedPage.generateMetadata({ params: Promise.resolve({ slug: "presale" }) });
    await closedPage.generateMetadata({ params: Promise.resolve({ slug: "pre-launch" }) });
    assert.equal(waitlistQueries(), 0);
  });

  for (const [slug, status] of [
    ["maintenance", "maintenance"],
    ["holiday", "holiday_break"],
    ["inventory", "inventory_update"],
    ["private-access", "private_access"],
  ] as Array<[string, StoreSettingsRow["store_status"]]>) {
    it(`${slug}: does not query the waitlist`, async () => {
      db.settings = settingsRow({ store_status: status, browsing_enabled: status === "private_access", checkout_enabled: false });
      db.waitlistTotal = 42;
      const html = await renderClosed(slug);
      assert.equal(waitlistQueries(), 0);
      assert.ok(!html.includes("subscribers"));
    });
  }

  it("pre-launch with showWaitlistCount: queries once and displays the exact count", async () => {
    db.settings = settingsRow({ store_status: "pre_launch", browsing_enabled: false, checkout_enabled: false });
    db.waitlistTotal = 7;
    const html = await renderClosed("pre-launch");
    assert.equal(waitlistQueries(), 1);
    assert.ok(html.includes("Join 7 subscribers waiting for launch"));
  });

  it("pre-launch with showWaitlistCount off: does not query the waitlist", async () => {
    db.settings = settingsRow({ store_status: "pre_launch", browsing_enabled: false, checkout_enabled: false, show_waitlist_count: false });
    db.waitlistTotal = 7;
    const html = await renderClosed("pre-launch");
    assert.equal(waitlistQueries(), 0);
    assert.ok(!html.includes("subscribers"));
  });

  it("pre-launch with a zero count: queries but keeps the count hidden", async () => {
    db.settings = settingsRow({ store_status: "pre_launch", browsing_enabled: false, checkout_enabled: false });
    db.waitlistTotal = 0;
    const html = await renderClosed("pre-launch");
    assert.equal(waitlistQueries(), 1);
    assert.ok(!html.includes("subscribers"));
  });

  it("presale with showWaitlistCount: queries once and displays the exact count", async () => {
    db.settings = settingsRow({ store_status: "presale", browsing_enabled: true, checkout_enabled: false });
    db.waitlistTotal = 15;
    const html = await renderClosed("presale");
    assert.equal(waitlistQueries(), 1);
    assert.ok(html.includes("Join 15 subscribers waiting for launch"));
  });

  it("presale with showWaitlistCount off: does not query the waitlist", async () => {
    db.settings = settingsRow({ store_status: "presale", browsing_enabled: true, checkout_enabled: false, show_waitlist_count: false });
    db.waitlistTotal = 15;
    const html = await renderClosed("presale");
    assert.equal(waitlistQueries(), 0);
    assert.ok(!html.includes("subscribers"));
  });

  it("presale with a zero count: queries but keeps the count hidden", async () => {
    db.settings = settingsRow({ store_status: "presale", browsing_enabled: true, checkout_enabled: false });
    db.waitlistTotal = 0;
    const html = await renderClosed("presale");
    assert.equal(waitlistQueries(), 1);
    assert.ok(!html.includes("subscribers"));
  });
});

describe("callers without a predicate are unchanged", () => {
  it("getEffectiveStoreControl() still fetches the count (checkout gate, superadmin)", async () => {
    db.settings = settingsRow();
    db.waitlistTotal = 3;
    const control = await server.getEffectiveStoreControl();
    assert.equal(waitlistQueries(), 1);
    assert.equal(control.waitlistCount, 3);
  });

  it("assertCheckoutAllowed decisions are unchanged", async () => {
    db.settings = settingsRow();
    assert.equal((await server.assertCheckoutAllowed()).ok, true);
    db.settings = settingsRow({ store_status: "presale", checkout_enabled: false });
    const blocked = await server.assertCheckoutAllowed();
    assert.equal(blocked.ok, false);
    assert.equal(!blocked.ok && blocked.code, "store_checkout_disabled");
  });
});
