import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Public store-control caching and guarded scheduled-transition saves.
 * Supabase is an in-memory PostgREST fake (global fetch) that honours eq/is
 * filters on PATCH; Next's data cache is an in-memory incremental cache.
 * Nothing here touches a real database.
 */

type Row = Record<string, unknown>;

const ANON_KEY = "unit-test-anon-key";
const SERVICE_KEY = "unit-test-service-role-key";
const PRIVATE_COLUMNS = ["private_access_password_hash", "private_access_ips"];
const EXPECTED_PUBLIC_COLUMNS = [
  "id", "store_status", "maintenance_message", "supporting_message", "reopening_date", "presale_date",
  "launch_date", "banner_text", "banner_enabled", "checkout_enabled", "browsing_enabled", "countdown_enabled",
  "presale_cta_label", "presale_hero_image_url", "maintenance_hero_image_url", "launch_hero_image_url",
  "instagram_url", "whatsapp_url", "scheduled_activate_at", "scheduled_deactivate_at", "scheduled_status",
  "scheduled_timezone", "revert_status", "show_waitlist_count", "maintenance_use_503", "updated_at",
];

/** ISO timestamp with microseconds, as Postgres returns it. */
function pgTime(offsetMs: number, micros = "123"): string {
  return new Date(Date.now() + offsetMs).toISOString().replace("Z", `${micros}+00:00`);
}

const UPDATED_AT = "2026-11-06T09:00:00.123456+00:00";

function baseRow(overrides: Row = {}): Row {
  return {
    id: 1,
    store_status: "live",
    maintenance_message: null,
    supporting_message: null,
    reopening_date: null,
    presale_date: null,
    launch_date: null,
    banner_text: "Legacy strip",
    banner_enabled: true,
    checkout_enabled: true,
    browsing_enabled: true,
    countdown_enabled: false,
    presale_cta_label: "Join waitlist",
    presale_hero_image_url: null,
    maintenance_hero_image_url: null,
    launch_hero_image_url: null,
    instagram_url: null,
    whatsapp_url: null,
    private_access_password_hash: "secret-hash-value",
    private_access_ips: ["203.0.113.9"],
    scheduled_activate_at: null,
    scheduled_deactivate_at: null,
    scheduled_status: null,
    scheduled_timezone: "Africa/Accra",
    revert_status: "live",
    show_waitlist_count: true,
    maintenance_use_503: false,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

function banner(id: string, overrides: Row = {}): Row {
  return {
    id,
    text: `Banner ${id}`,
    href: null,
    enabled: true,
    starts_at: null,
    ends_at: null,
    sort_order: 0,
    created_at: "2026-11-01T00:00:00+00:00",
    updated_at: "2026-11-01T00:00:00+00:00",
    ...overrides,
  };
}

const db = {
  settings: baseRow(),
  banners: [] as Row[],
  waitlistTotal: 0,
  failPublicSettings: false,
  missingPublicSettings: false,
  failBanners: false,
  /** not_committed: error, row untouched. committed: row updated, then an error response. */
  settingsUpdateError: null as null | "not_committed" | "committed",
  failSettingsReadAfterPatch: false,
  missingSettingsReadAfterPatch: false,
  /** Store timestamps the way Postgres prints them: trailing fractional zeros trimmed. */
  trimTimestampZeros: false,
  failBannerUpdate: false,
  failSiteSettingsUpdate: false,
  beforeSettingsUpdate: null as null | ((row: Row) => void),
  afterSettingsUpdate: null as null | ((row: Row) => void),
};

/** Postgres returns timestamps in its own format, not the string the client sent. */
function storedTimestamp(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (db.trimTimestampZeros) return value.replace(/(\.\d*?[1-9])0+(?=[+Z])/, "$1").replace(/\.0+(?=[+Z])/, "");
  return value.replace(/\+00:00$/, "Z");
}

/** The same `crypto` module object server.ts calls `randomInt` on (CommonJS under tsx). */
const nodeCrypto = createRequire(`${process.cwd()}/`)("crypto") as typeof import("crypto");

type Req = { table: string; method: string; url: URL; apikey: string | null; body: unknown };
const requests: Req[] = [];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function project(row: Row, select: string | null): Row {
  if (!select || select === "*") return { ...row };
  return Object.fromEntries(select.split(",").map((c) => c.trim()).map((c) => [c, row[c]]));
}

/** PostgREST-style filter match on raw stored values (eq / is.null). */
function matches(row: Row, params: URLSearchParams): boolean {
  for (const [col, expr] of params) {
    if (col === "select" || col === "order") continue;
    if (expr === "is.null") {
      if (row[col] !== null) return false;
    } else if (expr.startsWith("eq.")) {
      if (row[col] === null || row[col] === undefined || String(row[col]) !== expr.slice(3)) return false;
    } else {
      throw new Error(`unsupported filter ${col}=${expr}`);
    }
  }
  return true;
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? "GET").toUpperCase();
  const table = url.pathname.replace("/rest/v1/", "");
  const apikey = new Headers(init?.headers).get("apikey");
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  requests.push({ table, method, url, apikey, body });
  const select = url.searchParams.get("select");

  if (table === "store_settings_public") {
    if (select && PRIVATE_COLUMNS.some((c) => select.includes(c))) {
      return json({ message: "column does not exist" }, 400);
    }
    if (db.failPublicSettings) return json({ message: "view unavailable" }, 503);
    if (db.missingPublicSettings) return json([]);
    const publicRow = Object.fromEntries(Object.entries(db.settings).filter(([k]) => !PRIVATE_COLUMNS.includes(k)));
    return json([project(publicRow, select)]);
  }

  if (table === "store_settings") {
    if (method === "GET") {
      const patched = requests.some((r) => r.table === "store_settings" && r.method === "PATCH");
      if (db.failSettingsReadAfterPatch && patched) return json({ message: "read timeout" }, 503);
      if (db.missingSettingsReadAfterPatch && patched) return json([]);
      return json(matches(db.settings, url.searchParams) ? [project(db.settings, select)] : []);
    }
    if (method === "PATCH") {
      if (db.settingsUpdateError === "not_committed") return json({ message: "connection reset", code: "08006" }, 500);
      db.beforeSettingsUpdate?.(db.settings);
      if (!matches(db.settings, url.searchParams)) {
        return db.settingsUpdateError === "committed" ? json({ message: "gateway timeout" }, 504) : json([]);
      }
      const written = { ...(body as Row) };
      if ("updated_at" in written) written.updated_at = storedTimestamp(written.updated_at);
      Object.assign(db.settings, written);
      db.afterSettingsUpdate?.(db.settings);
      if (db.settingsUpdateError === "committed") return json({ message: "gateway timeout" }, 504);
      return json([project(db.settings, select)]);
    }
  }

  if (table === "store_banners") {
    if (method === "GET") return db.failBanners ? json({ message: "down" }, 503) : json(db.banners.map((b) => project(b, select)));
    if (method === "PATCH") {
      if (db.failBannerUpdate) return json({ message: "banners write failed" }, 500);
      const hit = db.banners.filter((b) => matches(b, url.searchParams));
      for (const b of hit) Object.assign(b, body as Row);
      return json([]);
    }
  }

  if (table === "site_settings" && method === "PATCH") {
    return db.failSiteSettingsUpdate ? json({ message: "site_settings write failed" }, 500) : json([]);
  }

  if (table === "store_waitlist" && method === "HEAD") {
    return new Response(null, { status: 200, headers: { "content-range": `*/${db.waitlistTotal}` } });
  }
  return json([]);
}

const cacheStore = new Map<string, { value: unknown; tags: string[] }>();
const fakeIncrementalCache = {
  isOnDemandRevalidate: false,
  async generateCacheKey(key: string) {
    return key;
  },
  async get(key: string) {
    const entry = cacheStore.get(key);
    return entry ? { isStale: false, value: entry.value } : null;
  },
  async set(key: string, data: unknown, ctx?: { tags?: string[] }) {
    cacheStore.set(key, { value: data, tags: ctx?.tags ?? [] });
  },
};

function count(table: string, method = "GET"): number {
  return requests.filter((r) => r.table === table && r.method === method).length;
}

function settingsPatchParams(): URLSearchParams {
  const patch = requests.filter((r) => r.table === "store_settings" && r.method === "PATCH");
  assert.equal(patch.length, 1, "exactly one settings save attempt");
  return patch[0].url.searchParams;
}

function withFixedNow<T>(now: number, fn: () => Promise<T>): Promise<T> {
  const realNow = Date.now;
  Date.now = () => now;
  return fn().finally(() => {
    Date.now = realNow;
  });
}

const BUCKET_START = Math.floor(Date.now() / 60_000) * 60_000 + 60_000 * 10;

type ServerModule = typeof import("../lib/store-control/server");
type PublicCacheModule = typeof import("../lib/store-control/public-cache");
type CatalogueCacheModule = typeof import("../lib/cache/public-catalogue");
type DisplayModule = typeof import("../lib/store-control/waitlist-display");
type ClosedPageModule = typeof import("../app/closed/[slug]/page");
let server: ServerModule;
let publicCache: PublicCacheModule;
let catalogueCache: CatalogueCacheModule;
let display: DisplayModule;
let closedPage: ClosedPageModule;
const consoleError = mock.method(console, "error", () => {});

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;
  server = await import("../lib/store-control/server");
  publicCache = await import("../lib/store-control/public-cache");
  catalogueCache = await import("../lib/cache/public-catalogue");
  display = await import("../lib/store-control/waitlist-display");
  closedPage = await import("../app/closed/[slug]/page");
});

after(() => consoleError.mock.restore());

beforeEach(() => {
  db.settings = baseRow();
  db.banners = [];
  db.waitlistTotal = 0;
  db.failPublicSettings = false;
  db.missingPublicSettings = false;
  db.failBanners = false;
  db.settingsUpdateError = null;
  db.failSettingsReadAfterPatch = false;
  db.missingSettingsReadAfterPatch = false;
  db.trimTimestampZeros = false;
  db.failBannerUpdate = false;
  db.failSiteSettingsUpdate = false;
  db.beforeSettingsUpdate = null;
  db.afterSettingsUpdate = null;
  requests.length = 0;
  cacheStore.clear();
  consoleError.mock.resetCalls();
});

describe("public settings cache", () => {
  it("reads store_settings_public with the anon key and the explicit public columns only", async () => {
    await publicCache.getStorefrontStoreControl();
    const reads = requests.filter((r) => r.table === "store_settings_public");
    assert.equal(reads.length, 1);
    assert.equal(reads[0].apikey, ANON_KEY);
    const cols = (reads[0].url.searchParams.get("select") ?? "").split(",").map((c) => c.trim());
    assert.deepEqual(cols, EXPECTED_PUBLIC_COLUMNS);
    for (const c of PRIVATE_COLUMNS) assert.ok(!cols.includes(c), c);
    assert.equal(count("store_settings"), 0, "base table not read on the cached path");
  });

  it("cached settings never contain private-access credentials or IP restrictions", async () => {
    const control = await publicCache.getStorefrontStoreControl();
    const cached = JSON.stringify([...cacheStore.values()]);
    assert.ok(!cached.includes("private_access"), "no private column names");
    assert.ok(!cached.includes("secret-hash-value"));
    assert.ok(!cached.includes("203.0.113.9"));
    assert.ok(!JSON.stringify(control).includes("secret-hash-value"));
  });

  it("settings and banners are separate entries with separate tags", async () => {
    db.banners = [banner("b1")];
    await publicCache.getStorefrontStoreControl();
    const entries = [...cacheStore.entries()];
    const settings = entries.filter(([k]) => k.includes("store-control-settings"));
    const banners = entries.filter(([k]) => k.includes("store-control-banners"));
    assert.equal(settings.length, 1);
    assert.equal(banners.length, 1);
    assert.deepEqual(settings[0][1].tags, [catalogueCache.PUBLIC_CACHE_TAGS.storeSettings]);
    assert.deepEqual(banners[0][1].tags, [catalogueCache.PUBLIC_CACHE_TAGS.storeBanners]);
    assert.equal(catalogueCache.STORE_CONTROL_CACHE_SECONDS, 60);
  });

  it("reuses both entries within one 60-second bucket", async () => {
    await withFixedNow(BUCKET_START + 1_000, async () => {
      await publicCache.getStorefrontStoreControl();
      await publicCache.getStorefrontStoreControl();
    });
    await withFixedNow(BUCKET_START + 59_000, () => publicCache.getStorefrontStoreControl());
    assert.equal(count("store_settings_public"), 1);
    assert.equal(count("store_banners"), 1);
  });

  it("a new bucket uses new keys and re-reads, bounding out-of-app edits to one window", async () => {
    await withFixedNow(BUCKET_START + 1_000, () => publicCache.getStorefrontStoreControl());
    db.settings.maintenance_message = "Edited in the Supabase dashboard";
    const stale = await withFixedNow(BUCKET_START + 30_000, () => publicCache.getStorefrontStoreControl());
    assert.notEqual(stale.maintenanceMessage, "Edited in the Supabase dashboard");
    const fresh = await withFixedNow(BUCKET_START + 61_000, () => publicCache.getStorefrontStoreControl());
    assert.equal(fresh.maintenanceMessage, "Edited in the Supabase dashboard");
    assert.equal(count("store_settings_public"), 2);
    const keys = [...cacheStore.keys()].filter((k) => k.includes("store-control-settings"));
    assert.equal(keys.length, 2);
    assert.ok(keys.some((k) => k.includes(String(publicCache.storeControlCacheBucket(BUCKET_START + 1_000)))));
  });

  it("banner entries are keyed by the settings updated_at", async () => {
    await publicCache.getStorefrontStoreControl();
    const bannerKey = [...cacheStore.keys()].find((k) => k.includes("store-control-banners"));
    assert.ok(bannerKey?.includes(JSON.stringify(UPDATED_AT).slice(1, -1)));
  });

  it("evaluates banner start and end dates per request without another query", async () => {
    db.banners = [
      banner("starts", { starts_at: new Date(BUCKET_START + 20_000).toISOString() }),
      banner("ends", { ends_at: new Date(BUCKET_START + 40_000).toISOString() }),
    ];
    const ids = async (now: number) =>
      (await withFixedNow(now, () => publicCache.getStorefrontStoreControl())).activeBanners.map((b) => b.id);
    assert.deepEqual(await ids(BUCKET_START + 10_000), ["ends"]);
    assert.deepEqual(await ids(BUCKET_START + 30_000), ["starts", "ends"]);
    assert.deepEqual(await ids(BUCKET_START + 50_000), ["starts"]);
    assert.equal(count("store_banners"), 1);
  });

  it("falls back to the uncached path when the cached read errors, without caching the error", async () => {
    db.failPublicSettings = true;
    const control = await publicCache.getStorefrontStoreControl();
    assert.equal(control.storeStatus, "live");
    assert.equal(count("store_settings"), 1, "authoritative base-table read");
    db.failPublicSettings = false;
    await publicCache.getStorefrontStoreControl();
    assert.equal(count("store_settings_public"), 2, "error was not cached");
  });

  it("treats a missing view row as an error (falls back) rather than live defaults", async () => {
    db.missingPublicSettings = true;
    db.settings = baseRow({ store_status: "maintenance", browsing_enabled: false, checkout_enabled: false });
    const control = await publicCache.getStorefrontStoreControl();
    assert.equal(control.storeStatus, "maintenance");
    assert.equal(count("store_settings"), 1);
  });

  it("falls back when the banner read errors", async () => {
    db.failBanners = true;
    db.settings = baseRow({ store_status: "presale", checkout_enabled: false });
    const control = await publicCache.getStorefrontStoreControl();
    assert.equal(control.storeStatus, "presale");
    assert.equal(count("store_settings"), 1);
  });
});

describe("cached due schedules use the uncached authoritative path", () => {
  /** Mocked Date (no sleeps): cache a not-yet-due row, then move past the due time within the same bucket. */
  async function acrossDueTime<T>(dueAt: number, during: () => void, fn: () => Promise<T>): Promise<T> {
    mock.timers.enable({ apis: ["Date"], now: dueAt - 4_000 });
    try {
      await publicCache.getStorefrontStoreControl();
      assert.equal(count("store_settings"), 0, "not due yet: served from the cache");
      mock.timers.setTime(dueAt + 1_000);
      during();
      requests.length = 0;
      return await fn();
    } finally {
      mock.timers.reset();
    }
  }

  it("a due schedule in a stale cached row never decides the displayed status", async () => {
    const dueAt = BUCKET_START + 5_000;
    db.settings = baseRow({ scheduled_activate_at: new Date(dueAt).toISOString(), scheduled_status: "presale" });
    const control = await acrossDueTime(
      dueAt,
      () =>
        // Out-of-app decision after the due time: maintenance, schedule cleared.
        Object.assign(db.settings, {
          store_status: "maintenance",
          browsing_enabled: false,
          checkout_enabled: false,
          scheduled_activate_at: null,
          scheduled_status: null,
        }),
      () => publicCache.getStorefrontStoreControl()
    );
    assert.equal(control.storeStatus, "maintenance");
    assert.equal(count("store_settings_public"), 0, "same bucket: cached row reused");
    assert.equal(count("store_settings"), 1, "fresh authoritative read");
    assert.equal(count("store_settings", "PATCH"), 0, "nothing due in the fresh row, no save");
  });

  it("persists the due transition from the fresh row and displays it", async () => {
    const dueAt = BUCKET_START + 5_000;
    db.settings = baseRow({ scheduled_activate_at: new Date(dueAt).toISOString(), scheduled_status: "presale" });
    const control = await acrossDueTime(dueAt, () => {}, () => publicCache.getStorefrontStoreControl());
    assert.equal(control.storeStatus, "presale");
    assert.equal(count("store_settings", "PATCH"), 1);
    assert.equal(db.settings.store_status, "presale");
    assert.equal(db.settings.scheduled_activate_at, null);
  });

  it("a not-yet-due schedule stays on the cached path", async () => {
    db.settings = baseRow({ scheduled_activate_at: pgTime(3_600_000), scheduled_status: "presale" });
    await publicCache.getStorefrontStoreControl();
    await publicCache.getStorefrontStoreControl();
    assert.equal(count("store_settings"), 0);
    assert.equal(count("store_settings", "PATCH"), 0);
  });
});

describe("conditional scheduled-transition UPDATE", () => {
  async function persistFromFreshRead() {
    const settings = await server.getStoreSettingsRow();
    assert.ok(settings);
    requests.length = 0;
    return server.persistScheduledIfDue(settings);
  }

  it("guards every read or written column with values from the fresh row", async () => {
    const activateAt = pgTime(-60_000, "654");
    db.settings = baseRow({ scheduled_activate_at: activateAt, scheduled_status: "presale" });
    const { outcome } = await persistFromFreshRead();
    assert.equal(outcome, "persisted");
    const p = settingsPatchParams();
    assert.equal(p.get("id"), "eq.1");
    assert.equal(p.get("updated_at"), `eq.${UPDATED_AT}`, "raw timestamp, microseconds kept");
    assert.equal(p.get("store_status"), "eq.live");
    assert.equal(p.get("browsing_enabled"), "eq.true");
    assert.equal(p.get("checkout_enabled"), "eq.true");
    assert.equal(p.get("revert_status"), "eq.live");
    assert.equal(p.get("scheduled_activate_at"), `eq.${activateAt}`, "raw timestamp, microseconds kept");
    assert.equal(p.get("scheduled_status"), "eq.presale");
    assert.equal(p.get("scheduled_deactivate_at"), "is.null");
    assert.equal(p.get("banner_enabled"), null, "not guarded when banner_enabled is not written");
    assert.equal(count("site_settings", "PATCH"), 1);
    assert.equal(count("store_banners", "PATCH"), 0, "not going live");
  });

  it("uses is.null for null schedule fields and eq for set ones (deactivation)", async () => {
    const deactivateAt = pgTime(-60_000);
    db.settings = baseRow({
      store_status: "maintenance",
      browsing_enabled: false,
      checkout_enabled: false,
      scheduled_deactivate_at: deactivateAt,
      revert_status: "presale",
    });
    const { outcome, settings } = await persistFromFreshRead();
    assert.equal(outcome, "persisted");
    assert.equal(settings.store_status, "presale");
    const p = settingsPatchParams();
    assert.equal(p.get("scheduled_activate_at"), "is.null");
    assert.equal(p.get("scheduled_status"), "is.null");
    assert.equal(p.get("scheduled_deactivate_at"), `eq.${deactivateAt}`);
    assert.equal(p.get("revert_status"), "eq.presale");
    assert.equal(p.get("browsing_enabled"), "eq.false");
  });

  it("go-live guards banner_enabled and clears banners once after the save matches", async () => {
    db.banners = [banner("b1"), banner("b2")];
    db.settings = baseRow({
      store_status: "presale",
      checkout_enabled: false,
      scheduled_deactivate_at: pgTime(-60_000),
      revert_status: "live",
    });
    const { outcome, settings } = await persistFromFreshRead();
    assert.equal(outcome, "persisted");
    assert.equal(settings.banner_enabled, false);
    assert.equal(settingsPatchParams().get("banner_enabled"), "eq.true");
    assert.equal(count("store_banners", "PATCH"), 1);
    assert.ok(db.banners.every((b) => b.enabled === false));
    assert.equal(count("site_settings", "PATCH"), 1);
  });

  const RESCHEDULED_AT = pgTime(3_600_000);
  const conflicts: Array<[string, Row, (row: Row) => void]> = [
    ["browsing_enabled", { scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" }, (r) => { r.browsing_enabled = false; }],
    ["checkout_enabled", { scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" }, (r) => { r.checkout_enabled = false; }],
    ["revert_status", { store_status: "maintenance", browsing_enabled: false, checkout_enabled: false, scheduled_deactivate_at: pgTime(-60_000), revert_status: "live" }, (r) => { r.revert_status = "presale"; }],
    ["banner_enabled", { store_status: "presale", checkout_enabled: false, scheduled_deactivate_at: pgTime(-60_000), revert_status: "live" }, (r) => { r.banner_enabled = false; }],
    ["store_status", { scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" }, (r) => { r.store_status = "maintenance"; }],
    ["updated_at", { scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" }, (r) => { r.updated_at = "2026-11-06T09:00:05.000001+00:00"; }],
    ["scheduled_activate_at", { scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" }, (r) => { r.scheduled_activate_at = RESCHEDULED_AT; }],
    ["scheduled_status", { scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" }, (r) => { r.scheduled_status = "soft_close"; }],
    ["scheduled_deactivate_at", { scheduled_deactivate_at: pgTime(-60_000), store_status: "presale", checkout_enabled: false }, (r) => { r.scheduled_deactivate_at = null; }],
  ];

  for (const [column, row, edit] of conflicts) {
    it(`an out-of-app change to ${column} between read and save is not overwritten`, async () => {
      db.banners = [banner("b1")];
      db.settings = baseRow(row);
      db.beforeSettingsUpdate = (current) => {
        edit(current);
        db.beforeSettingsUpdate = null;
      };
      const editedRow = { ...db.settings };
      edit(editedRow);
      const { outcome } = await persistFromFreshRead();
      assert.equal(outcome, "lost_race");
      assert.deepEqual(db.settings, editedRow, "row keeps the newer decision");
      assert.equal(count("store_settings", "PATCH"), 1, "no second save");
      assert.equal(count("store_banners", "PATCH"), 0, "no banner clearing");
      assert.equal(count("site_settings", "PATCH"), 0, "no site_settings sync");
      assert.equal(db.banners[0].enabled, true);
    });
  }

  it("a lost race re-reads the current row and resolves from it without saving again", async () => {
    db.settings = baseRow({ scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" });
    db.beforeSettingsUpdate = (current) => {
      Object.assign(current, {
        store_status: "maintenance",
        browsing_enabled: false,
        checkout_enabled: false,
        scheduled_activate_at: null,
        scheduled_status: null,
        updated_at: "2026-11-06T09:00:07.000001+00:00",
      });
    };
    const { outcome, settings } = await persistFromFreshRead();
    assert.equal(outcome, "lost_race");
    assert.equal(settings.store_status, "maintenance", "resolved from the fresh row");
    const order = requests.filter((r) => r.table === "store_settings").map((r) => r.method);
    assert.deepEqual(order, ["PATCH", "GET"]);
  });

  it("two simultaneous saves of the same due transition produce one set of side effects", async () => {
    db.banners = [banner("b1")];
    db.settings = baseRow({
      store_status: "presale",
      checkout_enabled: false,
      scheduled_deactivate_at: pgTime(-60_000),
      revert_status: "live",
    });
    const read = await server.getStoreSettingsRow();
    assert.ok(read);
    requests.length = 0;
    const results = await Promise.all([
      server.persistScheduledIfDue({ ...read }),
      server.persistScheduledIfDue({ ...read }),
    ]);
    assert.deepEqual(results.map((r) => r.outcome).sort(), ["lost_race", "persisted"]);
    assert.equal(count("store_settings", "PATCH"), 2);
    assert.equal(count("store_banners", "PATCH"), 1, "banners cleared once");
    assert.equal(count("site_settings", "PATCH"), 1, "site_settings synced once");
    assert.equal(db.settings.store_status, "live");
  });

  it("a database error that did not commit is reported as an error (not a lost race), with no side effects", async () => {
    db.banners = [banner("b1")];
    db.settings = baseRow({
      store_status: "presale",
      checkout_enabled: false,
      scheduled_deactivate_at: pgTime(-60_000),
      revert_status: "live",
    });
    db.settingsUpdateError = "not_committed";
    const { outcome } = await persistFromFreshRead();
    assert.equal(outcome, "error");
    assert.match(String(consoleError.mock.calls[0].arguments.join(" ")), /save returned an error; reconciling/);
    assert.equal(count("store_banners", "PATCH"), 0);
    assert.equal(count("site_settings", "PATCH"), 0);
    assert.equal(count("store_settings", "PATCH"), 1, "no second save");
    assert.equal(count("store_settings", "GET"), 1, "one reconciliation read");
    assert.equal(db.settings.store_status, "presale");
  });

  it("an unknown store status fails safe: no write and no side effects", async () => {
    db.banners = [banner("b1")];
    db.settings = baseRow({
      store_status: "flash_sale",
      scheduled_deactivate_at: pgTime(-60_000),
      revert_status: "live",
    });
    const before = { ...db.settings };
    const { outcome } = await persistFromFreshRead();
    assert.equal(outcome, "lost_race");
    assert.deepEqual(db.settings, before);
    assert.equal(count("store_banners", "PATCH"), 0);
    assert.equal(count("site_settings", "PATCH"), 0);
  });

  it("nothing due: no save attempt", async () => {
    const { outcome } = await persistFromFreshRead();
    assert.equal(outcome, "not_due");
    assert.equal(requests.length, 0);
  });
});

describe("ambiguous commits: reconciliation after an UPDATE error", () => {
  function goLiveRow(): Row {
    return baseRow({
      store_status: "presale",
      checkout_enabled: false,
      scheduled_deactivate_at: pgTime(-60_000),
      revert_status: "live",
    });
  }

  async function persistAfterRead() {
    const settings = await server.getStoreSettingsRow();
    assert.ok(settings);
    requests.length = 0;
    return server.persistScheduledIfDue(settings);
  }

  function writtenStamp(): string {
    const patch = requests.find((r) => r.table === "store_settings" && r.method === "PATCH");
    return String((patch?.body as Row).updated_at);
  }

  it("an UPDATE that committed but returned an error is confirmed and its side effects run exactly once", async () => {
    db.banners = [banner("b1"), banner("b2")];
    db.settings = goLiveRow();
    db.settingsUpdateError = "committed";
    const result = await persistAfterRead();
    assert.equal(result.outcome, "reconciled");
    assert.equal(result.sideEffects, "completed");
    assert.equal(result.hideBanners, true);
    assert.equal(result.settings.banner_enabled, false);
    assert.notEqual(db.settings.updated_at, writtenStamp(), "stored form differs from the sent string");
    assert.equal(count("store_settings", "PATCH"), 1, "no second save");
    assert.equal(count("store_settings", "GET"), 1, "one reconciliation read");
    assert.equal(count("store_banners", "PATCH"), 1);
    assert.equal(count("site_settings", "PATCH"), 1);
    assert.ok(db.banners.every((b) => b.enabled === false));
  });

  it("a failed reconciliation read is logged and reported as error_unverified, with no side effects", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.settingsUpdateError = "committed";
    db.failSettingsReadAfterPatch = true;
    const result = await persistAfterRead();
    assert.equal(result.outcome, "error_unverified");
    assert.equal(result.hideBanners, true);
    const logged = consoleError.mock.calls.map((c) => c.arguments.join(" ")).join("\n");
    assert.match(logged, /reconciliation read failed; save outcome unknown/);
    assert.equal(count("store_banners", "PATCH"), 0);
    assert.equal(count("site_settings", "PATCH"), 0);
    assert.equal(db.banners[0].enabled, true);
  });

  it("a later admin update after our commit is not mistaken for confirmation", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.settingsUpdateError = "committed";
    db.afterSettingsUpdate = (row) => {
      Object.assign(row, {
        store_status: "maintenance",
        browsing_enabled: false,
        checkout_enabled: false,
        updated_at: new Date(Date.now() + 5).toISOString(),
      });
    };
    const result = await persistAfterRead();
    assert.equal(result.outcome, "error");
    assert.equal(result.settings.store_status, "maintenance", "resolved from the fresh row");
    assert.equal(result.hideBanners, false);
    assert.equal(count("store_banners", "PATCH"), 0);
    assert.equal(count("site_settings", "PATCH"), 0);
  });

  it("an identical admin write in the same millisecond is not mistaken for confirmation", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.settingsUpdateError = "committed";
    db.afterSettingsUpdate = (row) => {
      // Same field values, millisecond-precision stamp (how every other app write stamps).
      row.updated_at = String(row.updated_at).replace(/(\.\d{3})\d{3}/, "$1000");
    };
    const result = await persistAfterRead();
    assert.equal(result.outcome, "error");
    assert.equal(count("store_banners", "PATCH"), 0);
    assert.equal(count("site_settings", "PATCH"), 0);
  });

  it("each save stamps updated_at with a unique non-zero microsecond suffix", async () => {
    db.settings = goLiveRow();
    await persistAfterRead();
    const stamp = writtenStamp();
    assert.match(stamp, /\.\d{6}\+00:00$/);
    assert.notEqual(stamp.slice(-9, -6), "000");
  });

  it("side-effect failures are logged, reported, and not silently swallowed", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.failBannerUpdate = true;
    db.failSiteSettingsUpdate = true;
    const result = await persistAfterRead();
    assert.equal(result.outcome, "persisted");
    assert.equal(result.sideEffects, "failed");
    const logged = consoleError.mock.calls.map((c) => c.arguments.join(" ")).join("\n");
    assert.match(logged, /clearing announcement banners failed: banners write failed/);
    assert.match(logged, /site_settings sync failed: site_settings write failed/);
    assert.equal(count("store_banners", "PATCH"), 1, "attempted once, not retried");
    assert.equal(count("site_settings", "PATCH"), 1);
  });

  const fieldMismatches: Array<[string, (row: Row) => void]> = [
    ["store_status", (r) => { r.store_status = "maintenance"; }],
    ["browsing_enabled", (r) => { r.browsing_enabled = false; }],
    ["checkout_enabled", (r) => { r.checkout_enabled = false; }],
    ["scheduled_status", (r) => { r.scheduled_status = "presale"; }],
    ["scheduled_activate_at", (r) => { r.scheduled_activate_at = "2026-12-01T10:00:00+00:00"; }],
    ["scheduled_deactivate_at", (r) => { r.scheduled_deactivate_at = "2026-12-01T10:00:00+00:00"; }],
    ["banner_enabled", (r) => { r.banner_enabled = true; }],
    ["updated_at (1 microsecond later)", (r) => {
      r.updated_at = String(r.updated_at).replace(/(\d)Z$/, (_m, d: string) => `${(Number(d) + 1) % 10}Z`);
    }],
  ];

  for (const [field, mutate] of fieldMismatches) {
    it(`a committed row differing only in ${field} is not confirmed: no side effects`, async () => {
      db.banners = [banner("b1")];
      db.settings = goLiveRow();
      db.settingsUpdateError = "committed";
      db.afterSettingsUpdate = mutate;
      const result = await persistAfterRead();
      assert.equal(result.outcome, "error");
      assert.equal(count("store_banners", "PATCH"), 0);
      assert.equal(count("site_settings", "PATCH"), 0);
      assert.equal(db.banners[0].enabled, true);
    });
  }

  it("a committed row differing only in an uncompared field is still confirmed (control case)", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.settingsUpdateError = "committed";
    db.afterSettingsUpdate = (r) => {
      r.maintenance_message = "Edited after the save";
    };
    const result = await persistAfterRead();
    assert.equal(result.outcome, "reconciled");
    assert.equal(count("store_banners", "PATCH"), 1);
    assert.equal(count("site_settings", "PATCH"), 1);
  });

  it("reconciles when Postgres returns the stamp with trailing fractional zeros trimmed", async () => {
    const randomInt = mock.method(nodeCrypto, "randomInt", (() => 100) as unknown as typeof nodeCrypto.randomInt);
    try {
      db.banners = [banner("b1")];
      db.settings = goLiveRow();
      db.settingsUpdateError = "committed";
      db.trimTimestampZeros = true;
      const result = await persistAfterRead();
      const sent = writtenStamp();
      assert.match(sent, /\.\d{3}100\+00:00$/, "suffix 100 sent");
      assert.match(String(db.settings.updated_at), /\.\d{3}1\+00:00$/, "stored as .xxx1, zeros trimmed");
      assert.notEqual(db.settings.updated_at, sent);
      assert.equal(result.outcome, "reconciled");
      assert.equal(count("store_banners", "PATCH"), 1);
      assert.equal(count("site_settings", "PATCH"), 1);
    } finally {
      randomInt.mock.restore();
    }
  });

  it("a missing row during reconciliation is error_unverified, logged, with no side effects", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.settingsUpdateError = "committed";
    db.missingSettingsReadAfterPatch = true;
    const result = await persistAfterRead();
    assert.equal(result.outcome, "error_unverified");
    const logged = consoleError.mock.calls.map((c) => c.arguments.join(" ")).join("\n");
    assert.match(logged, /reconciliation read failed; save outcome unknown.*store_settings row missing/);
    assert.equal(count("store_banners", "PATCH"), 0);
    assert.equal(count("site_settings", "PATCH"), 0);
  });

  it("a side-effect failure on the reconciled path is logged and reported", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.settingsUpdateError = "committed";
    db.failSiteSettingsUpdate = true;
    const result = await persistAfterRead();
    assert.equal(result.outcome, "reconciled");
    assert.equal(result.sideEffects, "failed");
    const logged = consoleError.mock.calls.map((c) => c.arguments.join(" ")).join("\n");
    assert.match(logged, /site_settings sync failed: site_settings write failed/);
    assert.equal(count("store_banners", "PATCH"), 1, "banner clearing still ran once");
    assert.ok(db.banners.every((b) => b.enabled === false));
  });

  it("a successful reconciliation logs only the reconciling notice, no failure", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.settingsUpdateError = "committed";
    const result = await persistAfterRead();
    assert.equal(result.outcome, "reconciled");
    assert.equal(result.sideEffects, "completed");
    const lines = consoleError.mock.calls.map((c) => c.arguments.join(" "));
    assert.equal(lines.length, 1);
    assert.match(lines[0], /save returned an error; reconciling/);
  });

  it("a successful save logs nothing", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    const result = await persistAfterRead();
    assert.equal(result.outcome, "persisted");
    assert.equal(consoleError.mock.callCount(), 0);
  });

  it("a lost race whose re-read fails is handled safely: no second save, no side effects", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.beforeSettingsUpdate = (r) => {
      r.store_status = "maintenance";
      db.beforeSettingsUpdate = null;
    };
    db.failSettingsReadAfterPatch = true;
    const result = await persistAfterRead();
    assert.equal(result.outcome, "lost_race");
    assert.equal(count("store_settings", "PATCH"), 1, "no second save");
    assert.equal(count("store_settings", "GET"), 1, "one re-read attempt");
    assert.equal(count("store_banners", "PATCH"), 0);
    assert.equal(count("site_settings", "PATCH"), 0);
    assert.equal(db.settings.store_status, "maintenance", "newer decision kept");
    assert.equal(result.verified, false, "state unknown: callers must not trust it");
    assert.match(String(consoleError.mock.calls.at(-1)?.arguments.join(" ")), /lost a race and the re-read failed/);
  });

  it("timestamps compare by instant across Postgres and JS formats, to the microsecond", () => {
    const t = server.timestampMicros;
    assert.equal(t("2026-11-06T16:00:00.123456+00:00"), t("2026-11-06T16:00:00.123456Z"));
    assert.equal(t("2026-11-06 16:00:00.123456+00"), t("2026-11-06T16:00:00.123456Z"));
    assert.equal(t("2026-11-06T18:00:00.123456+02:00"), t("2026-11-06T16:00:00.123456Z"));
    assert.equal(t("2026-11-06T16:00:00.123Z"), t("2026-11-06T16:00:00.123000+00:00"));
    assert.notEqual(t("2026-11-06T16:00:00.123456Z"), t("2026-11-06T16:00:00.123457Z"));
    assert.notEqual(t("2026-11-06T16:00:00.123999Z"), t("2026-11-06T16:00:00.124Z"));
    // Postgres trims trailing fractional zeros.
    assert.equal(t("2026-11-06T16:00:00.1231+00:00"), t("2026-11-06T16:00:00.123100Z"));
    assert.equal(t("2026-11-06T16:00:00.12+00:00"), t("2026-11-06T16:00:00.120000Z"));
    assert.equal(t("2026-11-06T16:00:00+00:00"), t("2026-11-06T16:00:00.000000Z"));
    assert.notEqual(t("2026-11-06T16:00:00.1231+00:00"), t("2026-11-06T16:00:00.123101Z"));
    assert.equal(t("not a date"), null);
    assert.equal(t(null), null);
  });
});

describe("announcement banners on a scheduled go-live", () => {
  function goLiveRow(): Row {
    return baseRow({
      store_status: "presale",
      checkout_enabled: false,
      scheduled_deactivate_at: pgTime(-60_000),
      revert_status: "live",
    });
  }

  it("are hidden immediately when the go-live is saved, even if banner clearing fails", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.failBannerUpdate = true;
    const control = await server.getEffectiveStoreControl();
    assert.equal(control.storeStatus, "live");
    assert.deepEqual(control.activeBanners, []);
    assert.equal(control.bannerText, null, "legacy strip hidden");
    assert.equal(db.banners[0].enabled, true, "write failed, but the render reflects the go-live");
    assert.equal(count("store_banners"), 0, "no banner read needed");
  });

  it("are hidden on a lost race to another instance that went live but has not cleared banners yet", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.beforeSettingsUpdate = (row) => {
      Object.assign(row, {
        store_status: "live",
        browsing_enabled: true,
        checkout_enabled: true,
        banner_enabled: false,
        scheduled_deactivate_at: null,
        updated_at: "2026-11-06T09:00:03.000777+00:00",
      });
    };
    const control = await server.getEffectiveStoreControl();
    assert.equal(control.storeStatus, "live");
    assert.deepEqual(control.activeBanners, []);
    assert.equal(db.banners[0].enabled, true);
  });

  it("stay visible on a lost race to a newer non-live decision (unchanged behaviour)", async () => {
    db.banners = [banner("b1")];
    db.settings = goLiveRow();
    db.beforeSettingsUpdate = (row) => {
      Object.assign(row, {
        store_status: "maintenance",
        browsing_enabled: false,
        checkout_enabled: false,
        scheduled_deactivate_at: null,
      });
    };
    const control = await server.getEffectiveStoreControl();
    assert.equal(control.storeStatus, "maintenance");
    assert.deepEqual(control.activeBanners.map((b) => b.id), ["b1"]);
    assert.equal(control.bannerText, "Legacy strip");
  });

  it("are hidden on the database-error paths (not committed, and unverified)", async () => {
    for (const setup of [
      () => {
        db.settingsUpdateError = "not_committed";
      },
      () => {
        db.settingsUpdateError = "committed";
        db.failSettingsReadAfterPatch = true;
      },
    ]) {
      db.banners = [banner("b1")];
      db.settings = goLiveRow();
      db.settingsUpdateError = null;
      db.failSettingsReadAfterPatch = false;
      requests.length = 0;
      setup();
      const control = await server.getEffectiveStoreControl();
      assert.equal(control.storeStatus, "live");
      assert.deepEqual(control.activeBanners, []);
      assert.equal(control.bannerText, null);
    }
  });

  it("stay visible for scheduled transitions that are not a go-live (unchanged behaviour)", async () => {
    db.banners = [banner("b1")];
    db.settings = baseRow({ scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" });
    const control = await server.getEffectiveStoreControl();
    assert.equal(control.storeStatus, "presale");
    assert.deepEqual(control.activeBanners.map((b) => b.id), ["b1"]);
    assert.equal(control.bannerText, "Legacy strip");
    assert.equal(count("store_banners", "PATCH"), 0);
  });
});

describe("authoritative reads stay uncached", () => {
  it("checkout enforcement reads the base table on every call, even when the public cache disagrees", async () => {
    const cached = await publicCache.getStorefrontStoreControl();
    assert.equal(cached.checkoutAllowed, true);
    Object.assign(db.settings, { store_status: "presale", checkout_enabled: false });
    requests.length = 0;
    const stale = await publicCache.getStorefrontStoreControl();
    assert.equal(stale.checkoutAllowed, true, "display cache is stale within its window");
    const gate1 = await server.assertCheckoutAllowed();
    const gate2 = await server.assertCheckoutAllowed();
    assert.equal(gate1.ok, false);
    assert.equal(gate2.ok, false);
    assert.equal(count("store_settings"), 2);
    assert.equal(requests.filter((r) => r.table === "store_settings").every((r) => r.apikey === SERVICE_KEY), true);
  });

  it("private-access reads use the uncached base table, including the hash and IP list", async () => {
    await publicCache.getStorefrontStoreControl();
    const a = await server.getStoreSettingsRow();
    const b = await server.getStoreSettingsRow();
    assert.equal(a?.private_access_password_hash, "secret-hash-value");
    assert.deepEqual(b?.private_access_ips, ["203.0.113.9"]);
    assert.equal(count("store_settings"), 2);
    const route = readFileSync("app/api/store-control/private-access/route.ts", "utf8");
    assert.match(route, /import \{ getStoreSettingsRow \} from "@\/lib\/store-control\/server";/);
    assert.doesNotMatch(route, /public-cache/);
  });

  it("admin snapshots read the base table on every call", async () => {
    await server.getStoreControlAdminSnapshot();
    await server.getStoreControlAdminSnapshot();
    assert.equal(count("store_settings"), 2);
    assert.equal(count("store_settings_public"), 0);
  });

  it("checkout, middleware and admin modules do not use the public cache", () => {
    for (const file of [
      "app/api/checkout/initialize/route.ts",
      "app/api/checkout/validate-discount/route.ts",
      "lib/store-control/edge.ts",
      "proxy.ts",
      "app/admin/store-control/page.tsx",
      "app/superadmin/store-control/page.tsx",
      "app/superadmin/page.tsx",
    ]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /public-cache/, file);
    }
  });
});

describe("waitlist count on the cached path (Step 2 behaviour)", () => {
  it("live: no waitlist query", async () => {
    db.waitlistTotal = 5;
    const control = await publicCache.getStorefrontStoreControl({
      includeWaitlistCount: display.storefrontShowsWaitlistCount,
    });
    assert.equal(count("store_waitlist", "HEAD"), 0);
    assert.equal(control.waitlistCount, 0);
  });

  it("eligible presale: counted on every render (never cached)", async () => {
    db.settings = baseRow({
      store_status: "presale",
      checkout_enabled: false,
      countdown_enabled: true,
      launch_date: pgTime(7 * 86_400_000),
    });
    db.waitlistTotal = 12;
    const first = await publicCache.getStorefrontStoreControl({ includeWaitlistCount: display.storefrontShowsWaitlistCount });
    db.waitlistTotal = 13;
    const second = await publicCache.getStorefrontStoreControl({ includeWaitlistCount: display.storefrontShowsWaitlistCount });
    assert.equal(first.waitlistCount, 12);
    assert.equal(second.waitlistCount, 13);
    assert.equal(count("store_waitlist", "HEAD"), 2);
    assert.equal(count("store_settings_public"), 1);
  });

  it("closed pre-launch page via the cache: exact count shown, zero hidden, metadata never counts", async () => {
    db.settings = baseRow({ store_status: "pre_launch", browsing_enabled: false, checkout_enabled: false });
    db.waitlistTotal = 7;
    const html = renderToStaticMarkup(
      (await closedPage.default({ params: Promise.resolve({ slug: "pre-launch" }) })) as ReactElement
    );
    assert.ok(html.includes("Join 7 subscribers waiting for launch"));
    db.waitlistTotal = 0;
    const hidden = renderToStaticMarkup(
      (await closedPage.default({ params: Promise.resolve({ slug: "pre-launch" }) })) as ReactElement
    );
    assert.ok(!hidden.includes("subscribers"));
    requests.length = 0;
    await closedPage.generateMetadata({ params: Promise.resolve({ slug: "pre-launch" }) });
    assert.equal(count("store_waitlist", "HEAD"), 0);
    assert.equal(count("store_settings"), 0, "closed pages use the cached path");
  });
});

describe("tag invalidation on store-control writes", () => {
  const STORE_TAGS = () => [catalogueCache.PUBLIC_CACHE_TAGS.storeSettings, catalogueCache.PUBLIC_CACHE_TAGS.storeBanners];

  for (const status of [200, 400, 500]) {
    it(`expires the tags after an authorised ${status} response`, async () => {
      const expired: unknown[] = [];
      const handler = catalogueCache.withPublicCacheExpiry(
        async () => new Response(null, { status }),
        STORE_TAGS(),
        (tags) => expired.push([...tags])
      );
      await handler(new Request("https://oandilabel.com/api/admin/store-control", { method: "PATCH" }));
      assert.deepEqual(expired, [STORE_TAGS()]);
    });
  }

  for (const status of [401, 403]) {
    it(`does not expire tags on ${status}`, async () => {
      const expired: unknown[] = [];
      const handler = catalogueCache.withPublicCacheExpiry(
        async () => new Response(null, { status }),
        STORE_TAGS(),
        (tags) => expired.push([...tags])
      );
      await handler(new Request("https://oandilabel.com/api/admin/store-control", { method: "PATCH" }));
      assert.deepEqual(expired, []);
    });
  }

  it("each store-control write route is wired to the correct tags; middleware invalidation is kept", () => {
    const control = readFileSync("app/api/admin/store-control/route.ts", "utf8");
    assert.match(control, /export const PATCH = withPublicCacheExpiry\(updateStoreControl, \[\s*PUBLIC_CACHE_TAGS\.storeSettings,\s*PUBLIC_CACHE_TAGS\.storeBanners,\s*\]\);/);
    assert.match(control, /export async function GET\(\)/, "read-only GET is not wrapped");
    assert.equal(control.match(/invalidateStoreControlEdgeCache\(\);/g)?.length, 1);
    assert.match(control, /if \(!hasMinAdminRole\(authz, "admin"\)\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);/);

    const banners = readFileSync("app/api/admin/store-control/banners/route.ts", "utf8");
    assert.match(banners, /const BANNER_CACHE_TAGS = \[PUBLIC_CACHE_TAGS\.storeBanners\] as const;/);
    assert.match(banners, /export const POST = withPublicCacheExpiry\(createBanner, BANNER_CACHE_TAGS\);/);
    assert.match(banners, /export const PATCH = withPublicCacheExpiry\(updateBanner, BANNER_CACHE_TAGS\);/);
    assert.match(banners, /export const DELETE = withPublicCacheExpiry\(deleteBanner, BANNER_CACHE_TAGS\);/);
    assert.equal(banners.match(/invalidateStoreControlEdgeCache\(\);/g)?.length, 3);
    assert.equal(banners.match(/if \(!authz\.isAdmin\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);/g)?.length, 3);

    const superadmin = readFileSync("app/api/superadmin/site-settings/route.ts", "utf8");
    assert.match(superadmin, /export const PATCH = withPublicCacheExpiry\(updateSiteSettings, \[PUBLIC_CACHE_TAGS\.storeSettings\]\);/);
    assert.equal(superadmin.match(/invalidateStoreControlEdgeCache\(\);/g)?.length, 1);
    assert.match(superadmin, /if \(!authz\.isSuperadmin\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);/);
  });
});
