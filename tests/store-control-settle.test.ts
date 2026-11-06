import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it, mock } from "node:test";

/**
 * Step 3B: settling overdue schedules before admin writes, stale schedule-form
 * protection, and the fail-closed checkout gate. Supabase is an in-memory
 * PostgREST fake (global fetch) honouring eq/is filters on PATCH.
 */

type Row = Record<string, unknown>;
type PatchKind = "scheduled" | "admin";

const SERVICE_KEY = "unit-test-service-role-key";
const UPDATED_AT = "2026-11-06T09:00:00.123457+00:00";

function pgTime(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString().replace("Z", "321+00:00");
}

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

function banner(id: string): Row {
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
  };
}

const db = {
  settings: baseRow() as Row | null,
  banners: [] as Row[],
  failSettingsRead: false,
  failSettingsReadAfterPatch: false,
  /** Error injection per settings PATCH: kind and 0-based index of that kind. */
  patchError: null as null | ((kind: PatchKind, n: number) => "not_committed" | "committed" | null),
  /** Runs before a settings PATCH is evaluated (simulates a concurrent writer). */
  beforeSettingsUpdate: null as null | ((row: Row, kind: PatchKind, n: number) => void),
};

type Req = { table: string; method: string; kind?: PatchKind; url: URL; body: unknown };
const requests: Req[] = [];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function project(row: Row, select: string | null): Row {
  if (!select || select === "*") return { ...row };
  return Object.fromEntries(select.split(",").map((c) => c.trim()).map((c) => [c, row[c]]));
}

const TIMESTAMP_COLUMNS = new Set(["updated_at", "scheduled_activate_at", "scheduled_deactivate_at"]);

/** Like Postgres timestamptz equality: by instant, to the microsecond, whatever the text format. */
function instantMicros(value: string): number {
  const fraction = /:\d{2}\.(\d+)/.exec(value)?.[1] ?? "";
  return Date.parse(value) * 1000 + Number(fraction.slice(3, 6).padEnd(3, "0"));
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [col, expr] of params) {
    if (col === "select" || col === "order") continue;
    if (expr === "is.null") {
      if (row[col] !== null) return false;
    } else if (expr.startsWith("eq.")) {
      if (row[col] === null || row[col] === undefined) return false;
      const value = expr.slice(3);
      const equal = TIMESTAMP_COLUMNS.has(col)
        ? instantMicros(String(row[col])) === instantMicros(value)
        : String(row[col]) === value;
      if (!equal) return false;
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
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  const select = url.searchParams.get("select");

  if (table === "store_settings" && method === "PATCH") {
    // Guarded scheduled saves always filter on revert_status; admin writes never do.
    const kind: PatchKind = url.searchParams.has("revert_status") ? "scheduled" : "admin";
    const n = requests.filter((r) => r.table === "store_settings" && r.kind === kind).length;
    requests.push({ table, method, kind, url, body });
    const mode = db.patchError?.(kind, n) ?? null;
    if (mode === "not_committed") return json({ message: "connection reset" }, 500);
    if (db.settings) db.beforeSettingsUpdate?.(db.settings, kind, n);
    if (!db.settings || !matches(db.settings, url.searchParams)) {
      return mode === "committed" ? json({ message: "gateway timeout" }, 504) : json([]);
    }
    Object.assign(db.settings, body as Row);
    if (mode === "committed") return json({ message: "gateway timeout" }, 504);
    return json([project(db.settings, select)]);
  }

  requests.push({ table, method, url, body });

  if (table === "store_settings") {
    const patched = requests.some((r) => r.table === "store_settings" && r.method === "PATCH");
    if (db.failSettingsRead || (db.failSettingsReadAfterPatch && patched)) return json({ message: "read timeout" }, 503);
    return json(db.settings && matches(db.settings, url.searchParams) ? [project(db.settings, select)] : []);
  }
  if (table === "store_banners") {
    if (method === "PATCH") {
      for (const b of db.banners.filter((x) => matches(x, url.searchParams))) Object.assign(b, body as Row);
      return json([]);
    }
    return json(db.banners.map((b) => project(b, select)));
  }
  if (table === "store_waitlist" && method === "HEAD") {
    return new Response(null, { status: 200, headers: { "content-range": "*/4" } });
  }
  return json([]);
}

function count(table: string, method = "GET"): number {
  return requests.filter((r) => r.table === table && r.method === method).length;
}

function settingsPatches(kind?: PatchKind): Req[] {
  return requests.filter((r) => r.table === "store_settings" && r.method === "PATCH" && (!kind || r.kind === kind));
}

function logged(): string {
  return consoleError.mock.calls.map((c) => c.arguments.join(" ")).join("\n");
}

type ServerModule = typeof import("../lib/store-control/server");
let server: ServerModule;
const consoleError = mock.method(console, "error", () => {});

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  globalThis.fetch = fakeFetch as typeof fetch;
  server = await import("../lib/store-control/server");
});

after(() => consoleError.mock.restore());

beforeEach(() => {
  db.settings = baseRow();
  db.banners = [];
  db.failSettingsRead = false;
  db.failSettingsReadAfterPatch = false;
  db.patchError = null;
  db.beforeSettingsUpdate = null;
  requests.length = 0;
  consoleError.mock.resetCalls();
});

function parse(body: Row) {
  const parsed = server.parseStoreControlPatch(body);
  assert.ok(parsed.ok, "valid patch");
  return parsed as Extract<typeof parsed, { ok: true }>;
}

async function adminPatch(body: Row) {
  const parsed = parse(body);
  return server.patchStoreSettings(parsed.patch, { expectedUpdatedAt: parsed.expectedUpdatedAt });
}

const overdueActivation = (): Row => baseRow({ scheduled_activate_at: pgTime(-60_000), scheduled_status: "presale" });
const overdueGoLive = (): Row =>
  baseRow({ store_status: "presale", checkout_enabled: false, scheduled_deactivate_at: pgTime(-60_000), revert_status: "live" });

describe("settling overdue schedules before admin status changes", () => {
  it("an overdue transition is saved first, then the admin's newer status wins", async () => {
    db.settings = overdueActivation();
    const result = await adminPatch({ store_status: "maintenance" });
    assert.ok(result.ok);
    assert.equal(result.settled, true);
    assert.deepEqual(settingsPatches().map((r) => r.kind), ["scheduled", "admin"]);
    assert.equal((settingsPatches("scheduled")[0].body as Row).store_status, "presale");
    assert.equal(db.settings?.store_status, "maintenance");
    assert.equal(db.settings?.scheduled_activate_at, null);
    assert.equal(db.settings?.checkout_enabled, false);
    assert.equal(count("site_settings", "PATCH"), 2, "transition sync, then admin sync");
  });

  it("an overdue go-live clears banners before the admin moves to maintenance", async () => {
    db.banners = [banner("b1")];
    db.settings = overdueGoLive();
    const result = await adminPatch({ store_status: "maintenance" });
    assert.ok(result.ok);
    assert.equal(count("store_banners", "PATCH"), 1);
    assert.equal(db.banners[0].enabled, false);
    assert.equal(db.settings?.store_status, "maintenance");
  });

  it("nothing due: one fresh read, no scheduled save, admin update applied", async () => {
    const result = await adminPatch({ store_status: "presale" });
    assert.ok(result.ok);
    assert.equal(result.settled, false);
    assert.equal(settingsPatches("scheduled").length, 0);
    assert.equal(settingsPatches("admin").length, 1);
    assert.equal(db.settings?.store_status, "presale");
  });

  it("a storefront save that wins the race is not repeated; the admin update follows", async () => {
    db.settings = overdueActivation();
    db.beforeSettingsUpdate = (row, kind, n) => {
      if (kind === "scheduled" && n === 0) {
        Object.assign(row, {
          store_status: "presale",
          checkout_enabled: false,
          scheduled_activate_at: null,
          scheduled_status: null,
          updated_at: "2026-11-06T09:00:01.000654+00:00",
        });
      }
    };
    const result = await adminPatch({ store_status: "maintenance" });
    assert.ok(result.ok);
    assert.equal(settingsPatches("scheduled").length, 1, "lost race, then nothing due on re-read");
    assert.equal(settingsPatches("admin").length, 1);
    assert.equal(db.settings?.store_status, "maintenance");
  });

  it("a concurrent storefront render and admin save: one transition save, side effects once, admin wins", async () => {
    db.banners = [banner("b1")];
    db.settings = overdueGoLive();
    const [, result] = await Promise.all([
      server.getEffectiveStoreControl(),
      adminPatch({ store_status: "maintenance" }),
    ]);
    assert.ok(result.ok);
    assert.equal(count("store_banners", "PATCH"), 1, "banners cleared exactly once");
    assert.equal(db.settings?.store_status, "maintenance");
    assert.equal(db.settings?.scheduled_deactivate_at, null);
  });

  it("returns 409 after three attempts that keep losing, and never applies the admin update", async () => {
    db.settings = overdueActivation();
    db.beforeSettingsUpdate = (row, kind, n) => {
      if (kind === "scheduled") row.updated_at = `2026-11-06T09:00:0${n + 2}.000111+00:00`;
    };
    const result = await adminPatch({ store_status: "maintenance" });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 409);
    assert.equal(!result.ok && result.code, "schedule_settle_conflict");
    assert.equal(settingsPatches("scheduled").length, 3);
    assert.equal(settingsPatches("admin").length, 0);
    assert.equal(db.settings?.store_status, "live");
    assert.match(logged(), /\[store-control\] schedule settling: still not settled after 3 attempts/);
  });

  it("three scheduled saves that all fail without committing: 503 unavailable (not 409), admin update not applied", async () => {
    db.settings = overdueActivation();
    db.patchError = (kind) => (kind === "scheduled" ? "not_committed" : null);
    const result = await adminPatch({ store_status: "maintenance" });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 503);
    assert.equal(!result.ok && result.code, "store_state_unavailable");
    assert.equal(settingsPatches("scheduled").length, 3, "the three-attempt bound is kept");
    assert.equal(settingsPatches("admin").length, 0);
    assert.equal(db.settings?.store_status, "live");
    assert.match(logged(), /\[store-control\] schedule settling: scheduled save failed; not settled after 3 attempts/);
    assert.doesNotMatch(logged(), /still not settled after/);
  });

  it("a mix of lost races and a failed save is reported as unavailable (503)", async () => {
    db.settings = overdueActivation();
    db.beforeSettingsUpdate = (row, kind, n) => {
      if (kind === "scheduled" && n !== 1) row.updated_at = `2026-11-06T09:00:0${n + 2}.000333+00:00`;
    };
    db.patchError = (kind, n) => (kind === "scheduled" && n === 1 ? "not_committed" : null);
    const result = await adminPatch({ store_status: "maintenance" });
    assert.equal(!result.ok && result.status, 503);
    assert.equal(settingsPatches("admin").length, 0);
  });

  it("the superadmin toggle also maps persistent save failures to 503 and writes nothing", async () => {
    db.settings = overdueActivation();
    db.patchError = (kind) => (kind === "scheduled" ? "not_committed" : null);
    const result = await server.applySuperadminMaintenanceStatus(true);
    assert.equal(!result.ok && result.status, 503);
    assert.equal(!result.ok && result.code, "store_state_unavailable");
    assert.equal(settingsPatches("admin").length, 0);
  });

  it("an unverified scheduled save returns 503 and the admin update is not applied", async () => {
    db.settings = overdueActivation();
    db.patchError = (kind) => (kind === "scheduled" ? "committed" : null);
    db.failSettingsReadAfterPatch = true;
    const result = await adminPatch({ store_status: "maintenance" });
    assert.equal(!result.ok && result.status, 503);
    assert.equal(!result.ok && result.code, "store_state_unavailable");
    assert.equal(result.settled, true, "may have written: the route still clears the middleware cache");
    assert.equal(settingsPatches("admin").length, 0);
  });

  it("a failed settings read returns 503 with no writes", async () => {
    db.failSettingsRead = true;
    const result = await adminPatch({ store_status: "maintenance" });
    assert.equal(!result.ok && result.status, 503);
    assert.equal(settingsPatches().length, 0);
    assert.match(logged(), /\[store-control\] schedule settling: settings read failed/);
  });

  it("a missing settings row returns 503 with no writes", async () => {
    db.settings = null;
    const result = await adminPatch({ store_status: "maintenance" });
    assert.equal(!result.ok && result.status, 503);
    assert.equal(settingsPatches().length, 0);
  });

  it("a save that did not commit is retried within the bound, then the admin update applies", async () => {
    db.settings = overdueActivation();
    db.patchError = (kind, n) => (kind === "scheduled" && n === 0 ? "not_committed" : null);
    const result = await adminPatch({ store_status: "maintenance" });
    assert.ok(result.ok);
    assert.equal(settingsPatches("scheduled").length, 2);
    assert.equal(settingsPatches("admin").length, 1);
    assert.equal(db.settings?.store_status, "maintenance");
  });

  it("authorisation is checked before any settling or write in both routes", () => {
    const control = readFileSync("app/api/admin/store-control/route.ts", "utf8");
    assert.ok(control.indexOf('hasMinAdminRole(authz, "admin")') < control.indexOf("patchStoreSettings(parsed.patch"));
    const superadmin = readFileSync("app/api/superadmin/site-settings/route.ts", "utf8");
    assert.ok(superadmin.indexOf("authz.isSuperadmin") < superadmin.indexOf("applySuperadminMaintenanceStatus(maintenanceMode)"));
  });
});

describe("superadmin maintenance toggle", () => {
  it("settles an overdue schedule, then applies maintenance with its recommended flags", async () => {
    db.settings = overdueActivation();
    const result = await server.applySuperadminMaintenanceStatus(true);
    assert.ok(result.ok);
    assert.equal(result.settled, true);
    assert.deepEqual(settingsPatches().map((r) => r.kind), ["scheduled", "admin"]);
    assert.equal(db.settings?.store_status, "maintenance");
    assert.equal(db.settings?.browsing_enabled, false);
    assert.equal(db.settings?.checkout_enabled, false);
  });

  it("returns 409 and writes nothing when the schedule cannot be settled", async () => {
    db.settings = overdueActivation();
    db.beforeSettingsUpdate = (row, kind, n) => {
      if (kind === "scheduled") row.updated_at = `2026-11-06T09:00:0${n + 2}.000222+00:00`;
    };
    const result = await server.applySuperadminMaintenanceStatus(true);
    assert.equal(!result.ok && result.status, 409);
    assert.equal(settingsPatches("admin").length, 0);
  });

  it("returns 503 and writes nothing when the settings cannot be read", async () => {
    db.failSettingsRead = true;
    const result = await server.applySuperadminMaintenanceStatus(false);
    assert.equal(!result.ok && result.status, 503);
    assert.equal(settingsPatches().length, 0);
  });

  it("a store_settings update error is reported (500), not ignored", async () => {
    db.patchError = (kind) => (kind === "admin" ? "not_committed" : null);
    const result = await server.applySuperadminMaintenanceStatus(true);
    assert.equal(!result.ok && result.status, 500);
    assert.equal(!result.ok && result.code, "store_settings_update_failed");
    assert.match(logged(), /\[store-control\] superadmin store status update failed/);
    assert.equal(db.settings?.store_status, "live");
  });

  it("the route returns before writing site_settings when the status write fails", () => {
    const route = readFileSync("app/api/superadmin/site-settings/route.ts", "utf8");
    const statusCall = route.indexOf("applySuperadminMaintenanceStatus(maintenanceMode)");
    const earlyReturn = route.indexOf("if (!statusResult.ok)");
    const siteWrite = route.indexOf('.from("site_settings")');
    assert.ok(statusCall > 0 && statusCall < earlyReturn && earlyReturn < siteWrite);
    assert.doesNotMatch(route, /\.from\("store_settings"\)/, "store_settings is only written via the settling helper");
    assert.equal(route.match(/invalidateStoreControlEdgeCache\(\);/g)?.length, 1);
  });
});

describe("stale schedule forms", () => {
  const futureAt = () => pgTime(3 * 86_400_000);

  it("a form loaded before a transition ran is rejected with 409 and cannot re-arm it", async () => {
    // The scheduled activation already ran: schedule cleared, updated_at moved on.
    db.settings = baseRow({ store_status: "presale", checkout_enabled: false, updated_at: "2026-11-06T10:00:00.000789+00:00" });
    const result = await adminPatch({
      scheduled_activate_at: pgTime(-60_000),
      scheduled_status: "presale",
      scheduled_deactivate_at: null,
      revert_status: "live",
      expected_updated_at: UPDATED_AT,
    });
    assert.equal(!result.ok && result.status, 409);
    assert.equal(!result.ok && result.code, "settings_changed");
    assert.match(!result.ok ? result.error : "", /changed since you loaded them/);
    assert.equal(settingsPatches("admin").length, 0);
    assert.equal(db.settings?.scheduled_activate_at, null);
  });

  it("a form loaded while a schedule was overdue gets 409 after settling runs that schedule", async () => {
    db.settings = overdueActivation();
    const result = await adminPatch({
      scheduled_activate_at: db.settings.scheduled_activate_at,
      scheduled_status: "presale",
      revert_status: "live",
      expected_updated_at: UPDATED_AT,
    });
    assert.equal(!result.ok && result.code, "settings_changed");
    assert.equal(result.settled, true);
    assert.equal(db.settings?.store_status, "presale", "the earlier transition was applied");
    assert.equal(db.settings?.scheduled_activate_at, null, "not re-armed");
  });

  it("a current form saves, with an atomic updated_at condition using the raw timestamp", async () => {
    const at = futureAt();
    const result = await adminPatch({
      scheduled_activate_at: at,
      scheduled_status: "presale",
      revert_status: "live",
      expected_updated_at: UPDATED_AT,
    });
    assert.ok(result.ok);
    const adminWrite = settingsPatches("admin")[0];
    assert.equal(adminWrite.url.searchParams.get("updated_at"), `eq.${UPDATED_AT}`);
    assert.equal(db.settings?.scheduled_activate_at, at);
  });

  it("a change landing between the version check and the update is rejected atomically (409)", async () => {
    db.beforeSettingsUpdate = (row, kind) => {
      if (kind === "admin") row.updated_at = "2026-11-06T09:00:09.000999+00:00";
    };
    const result = await adminPatch({
      scheduled_activate_at: futureAt(),
      scheduled_status: "presale",
      expected_updated_at: UPDATED_AT,
    });
    assert.equal(!result.ok && result.code, "settings_changed");
    assert.equal(db.settings?.scheduled_activate_at, null);
  });

  it("compares the version to the microsecond", async () => {
    const stale = await adminPatch({
      scheduled_activate_at: futureAt(),
      expected_updated_at: "2026-11-06T09:00:00.123456+00:00",
    });
    assert.equal(!stale.ok && stale.code, "settings_changed");
    const same = await adminPatch({
      scheduled_activate_at: futureAt(),
      expected_updated_at: "2026-11-06T09:00:00.123457Z",
    });
    assert.ok(same.ok, "same instant in another format is accepted");
  });

  it("rejects a changed activation time in the past (400) without writing", async () => {
    const result = await adminPatch({
      scheduled_activate_at: pgTime(-3_600_000),
      scheduled_status: "presale",
      expected_updated_at: UPDATED_AT,
    });
    assert.equal(!result.ok && result.status, 400);
    assert.equal(!result.ok && result.code, "schedule_in_past");
    assert.equal(settingsPatches("admin").length, 0);
  });

  it("rejects a changed revert time in the past (400)", async () => {
    const result = await adminPatch({ scheduled_deactivate_at: pgTime(-3_600_000), expected_updated_at: UPDATED_AT });
    assert.equal(!result.ok && result.code, "schedule_in_past");
  });

  it("allows an unchanged existing past value (re-sent in another format)", async () => {
    const stored = "2026-11-01T08:00:00.5+00:00";
    db.settings = baseRow({ scheduled_activate_at: stored, scheduled_status: null });
    const result = await adminPatch({
      scheduled_activate_at: "2026-11-01T08:00:00.500Z",
      scheduled_status: null,
      launch_date: futureAt(),
      expected_updated_at: UPDATED_AT,
    });
    assert.ok(result.ok);
  });

  it("rejects arming an unchanged past activation by setting a target mode", async () => {
    db.settings = baseRow({ scheduled_activate_at: "2026-11-01T08:00:00+00:00", scheduled_status: null });
    const result = await adminPatch({
      scheduled_activate_at: "2026-11-01T08:00:00+00:00",
      scheduled_status: "presale",
      expected_updated_at: UPDATED_AT,
    });
    assert.equal(!result.ok && result.code, "schedule_in_past");
  });

  it("allows clearing schedule fields", async () => {
    db.settings = baseRow({ scheduled_activate_at: futureAt(), scheduled_status: "presale" });
    const result = await adminPatch({
      scheduled_activate_at: null,
      scheduled_status: null,
      scheduled_deactivate_at: null,
      expected_updated_at: UPDATED_AT,
    });
    assert.ok(result.ok);
    assert.equal(db.settings?.scheduled_activate_at, null);
  });

  it("schedule saves without expected_updated_at are rejected before any read or write", async () => {
    const result = await adminPatch({ scheduled_activate_at: futureAt(), scheduled_status: "presale" });
    assert.equal(!result.ok && result.status, 400);
    assert.equal(!result.ok && result.code, "expected_updated_at_required");
    assert.equal(requests.length, 0);
  });

  it("status changes, toggles and messaging saves never need a version and never get settings_changed", async () => {
    for (const body of [
      { store_status: "presale" },
      { checkout_enabled: false },
      { maintenance_message: "Back soon" },
    ]) {
      db.settings = baseRow({ updated_at: "2026-11-06T11:11:11.000123+00:00" });
      const result = await adminPatch(body);
      assert.ok(result.ok, JSON.stringify(body));
    }
    assert.ok(settingsPatches("admin").every((r) => !r.url.searchParams.has("updated_at")));
  });

  it("parses expected_updated_at and rejects invalid values", () => {
    assert.equal(parse({ revert_status: "live", expected_updated_at: UPDATED_AT }).expectedUpdatedAt, UPDATED_AT);
    assert.equal(parse({ revert_status: "live" }).expectedUpdatedAt, null);
    assert.deepEqual(server.parseStoreControlPatch({ revert_status: "live", expected_updated_at: 5 }), {
      ok: false,
      error: "Invalid expected_updated_at",
    });
    assert.deepEqual(server.parseStoreControlPatch({ revert_status: "live", expected_updated_at: "yesterday" }), {
      ok: false,
      error: "Invalid expected_updated_at",
    });
  });

  it("the dashboard sends the loaded version with schedule saves only", () => {
    const dashboard = readFileSync("components/admin/store-control-dashboard.tsx", "utf8");
    assert.equal(dashboard.match(/expected_updated_at: settings\.updated_at/g)?.length, 1);
    const scheduleSave = dashboard.slice(dashboard.indexOf("scheduled_timezone: settings.scheduled_timezone"));
    assert.ok(scheduleSave.indexOf("expected_updated_at") < scheduleSave.indexOf("Save schedule"));
    assert.match(dashboard, /await save\(\{ store_status: nextStatus, apply_recommended_flags: true \}\)/);
  });

  it("dashboard save() reports success or failure explicitly", () => {
    const dashboard = readFileSync("components/admin/store-control-dashboard.tsx", "utf8");
    const save = dashboard.slice(dashboard.indexOf("async function save("), dashboard.indexOf("async function confirmStatusChange("));
    assert.match(save, /async function save\(patch: Record<string, unknown>\): Promise<boolean>/);
    assert.match(save, /if \(!res\.ok\) throw new Error\(json\.error \?\? "Could not save"\);/, "409/503 go to the failure path");
    assert.match(save, /setNotice\("Saved — changes are live\."\);\s*return true;/);
    assert.match(save, /setError\(e instanceof Error \? e\.message : "Could not save"\);\s*return false;/);
  });

  it("dashboard status changes are reverted on failure and banner state changes only after success", () => {
    const dashboard = readFileSync("components/admin/store-control-dashboard.tsx", "utf8");
    const start = dashboard.indexOf("async function confirmStatusChange(");
    const fn = dashboard.slice(start, dashboard.indexOf("async function loadWaitlist(", start));
    const confirmed = fn.indexOf("const confirmedStatus = settings.store_status;");
    const optimistic = fn.indexOf("setSettings((s) => ({ ...s, store_status: nextStatus }));");
    const saved = fn.indexOf("const saved = await save({ store_status: nextStatus, apply_recommended_flags: true });");
    const revert = fn.indexOf("if (!saved) {\n      setSettings((s) => ({ ...s, store_status: confirmedStatus }));");
    const goLive = fn.indexOf('} else if (nextStatus === "live") {');
    const bannerChange = fn.indexOf("banners: prev.banners.map((b) => ({ ...b, enabled: false })),");
    assert.ok(confirmed >= 0 && confirmed < optimistic && optimistic < saved, "last confirmed status captured first");
    assert.ok(saved < revert, "failure restores the last confirmed status");
    const legacyBanner = fn.indexOf("setSettings((s) => ({ ...s, banner_enabled: false }));");
    assert.ok(revert < goLive && goLive < bannerChange, "banners are only changed in the success branch");
    assert.ok(goLive < legacyBanner, "legacy banner flag is only changed in the success branch");
    assert.equal(fn.match(/banners\.map/g)?.length, 1);
    assert.equal(fn.match(/banner_enabled: false/g)?.length, 1);
  });

  it("the admin route passes the version through and maps failures to their status codes", () => {
    const route = readFileSync("app/api/admin/store-control/route.ts", "utf8");
    assert.match(route, /patchStoreSettings\(parsed\.patch, \{ expectedUpdatedAt: parsed\.expectedUpdatedAt \}\)/);
    assert.match(route, /status: result\.status/);
    assert.match(route, /"Retry-After": String\(STORE_STATE_UNAVAILABLE_RETRY_SECONDS\)/);
    assert.equal(route.match(/invalidateStoreControlEdgeCache\(\);/g)?.length, 1);
  });
});

describe("checkout gate fails closed on unknown store state", () => {
  it("a failed settings read: 503 store_state_unavailable, Retry-After 30; display fallback unchanged", async () => {
    db.failSettingsRead = true;
    const gate = await server.assertCheckoutAllowed();
    assert.equal(gate.ok, false);
    assert.equal(!gate.ok && gate.status, 503);
    assert.equal(!gate.ok && gate.code, "store_state_unavailable");
    assert.equal(!gate.ok && gate.retryAfterSeconds, 30);
    const display = await server.getEffectiveStoreControl();
    assert.equal(display.storeStatus, "live", "browsing display keeps its existing fallback");
  });

  it("a missing settings row fails closed", async () => {
    db.settings = null;
    const gate = await server.assertCheckoutAllowed();
    assert.equal(!gate.ok && gate.code, "store_state_unavailable");
  });

  it("an unverified scheduled save fails closed", async () => {
    db.settings = overdueGoLive();
    db.patchError = () => "committed";
    db.failSettingsReadAfterPatch = true;
    const gate = await server.assertCheckoutAllowed();
    assert.equal(!gate.ok && gate.code, "store_state_unavailable");
  });

  it("a lost race whose re-read fails fails closed, and the re-read failure is logged without settings data", async () => {
    db.settings = overdueGoLive();
    db.beforeSettingsUpdate = (row) => {
      row.store_status = "maintenance";
    };
    db.failSettingsReadAfterPatch = true;
    const gate = await server.assertCheckoutAllowed();
    assert.equal(!gate.ok && gate.code, "store_state_unavailable");
    assert.match(
      logged(),
      /\[store-control\] scheduled transition lost a race and the re-read failed; current store state unknown: read timeout/
    );
    assert.doesNotMatch(logged(), /secret-hash-value|203\.0\.113\.9/);
  });

  it("the lost-race re-read failure is reported as unverified by the scheduled save", async () => {
    db.settings = overdueGoLive();
    db.beforeSettingsUpdate = (row) => {
      row.store_status = "maintenance";
    };
    const read = await server.getStoreSettingsRow();
    assert.ok(read);
    db.failSettingsReadAfterPatch = true;
    const result = await server.persistScheduledIfDue(read);
    assert.equal(result.outcome, "lost_race");
    assert.equal(result.verified, false);
  });

  it("a save that did not commit but whose re-read succeeds enforces normally (allowed and blocked)", async () => {
    db.settings = overdueGoLive();
    db.patchError = () => "not_committed";
    assert.equal((await server.assertCheckoutAllowed()).ok, true, "transition to live, verified");

    db.settings = baseRow({ scheduled_activate_at: pgTime(-60_000), scheduled_status: "maintenance" });
    requests.length = 0;
    const gate = await server.assertCheckoutAllowed();
    assert.equal(!gate.ok && gate.code, "store_checkout_disabled");
  });

  it("confirmed checkout disabled keeps store_checkout_disabled with Retry-After 3600", async () => {
    db.settings = baseRow({ store_status: "presale", checkout_enabled: false, maintenance_message: "Presale only" });
    const gate = await server.assertCheckoutAllowed();
    assert.equal(!gate.ok && gate.code, "store_checkout_disabled");
    assert.equal(!gate.ok && gate.retryAfterSeconds, 3600);
    assert.equal(!gate.ok && gate.error, "Presale only");
  });

  it("confirmed checkout enabled is allowed, without a waitlist count query", async () => {
    const gate = await server.assertCheckoutAllowed();
    assert.equal(gate.ok, true);
    assert.equal(count("store_waitlist", "HEAD"), 0);
  });

  it("checkout routes send the gate's Retry-After; payment, webhook and fulfilment routes do not use the gate", () => {
    for (const file of ["app/api/checkout/initialize/route.ts", "app/api/checkout/validate-discount/route.ts"]) {
      const src = readFileSync(file, "utf8");
      assert.match(src, /"Retry-After": String\(checkoutGate\.retryAfterSeconds\)/, file);
      assert.doesNotMatch(src, /"Retry-After": "3600"/, file);
    }
    for (const file of [
      "app/api/checkout/payment-status/route.ts",
      "app/api/webhooks/moolre/route.ts",
      "app/api/admin/orders/[orderId]/confirm-payment/route.ts",
      "app/api/admin/orders/reconcile-payments/route.ts",
      "proxy.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /assertCheckoutAllowed|loadEffectiveStoreControl|store-control\/server/, file);
    }
  });
});
