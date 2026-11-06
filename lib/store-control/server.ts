import { randomInt } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  applyScheduledTransitions,
  resolveEffectiveStoreControl,
} from "@/lib/store-control/resolve";
import type {
  EffectiveStoreControl,
  StoreBannerRow,
  StoreSettingsRow,
  StoreStatus,
} from "@/lib/store-control/types";
import { isStoreStatus } from "@/lib/store-control/resolve";
import { hashPrivateAccessPassword } from "@/lib/store-control/access";
import { getStoreControlAnalytics } from "@/lib/store-control/analytics";
import { recommendedFlagsForStatus } from "@/lib/store-control/constants";
import { getWaitlistCount } from "@/lib/store-control/waitlist";

const SETTINGS_SELECT =
  "id, store_status, maintenance_message, supporting_message, reopening_date, presale_date, launch_date, banner_text, banner_enabled, checkout_enabled, browsing_enabled, countdown_enabled, presale_cta_label, presale_hero_image_url, maintenance_hero_image_url, launch_hero_image_url, instagram_url, whatsapp_url, private_access_password_hash, private_access_ips, scheduled_activate_at, scheduled_deactivate_at, scheduled_status, scheduled_timezone, revert_status, show_waitlist_count, maintenance_use_503, updated_at";

export function mapSettingsRow(row: Record<string, unknown>): StoreSettingsRow {
  return {
    id: Number(row.id ?? 1),
    store_status: isStoreStatus(row.store_status) ? row.store_status : "live",
    maintenance_message: (row.maintenance_message as string | null) ?? null,
    supporting_message: (row.supporting_message as string | null) ?? null,
    reopening_date: (row.reopening_date as string | null) ?? null,
    presale_date: (row.presale_date as string | null) ?? null,
    launch_date: (row.launch_date as string | null) ?? null,
    banner_text: (row.banner_text as string | null) ?? null,
    banner_enabled: Boolean(row.banner_enabled),
    checkout_enabled: Boolean(row.checkout_enabled),
    browsing_enabled: Boolean(row.browsing_enabled),
    countdown_enabled: Boolean(row.countdown_enabled),
    presale_cta_label: String(row.presale_cta_label ?? "Join waitlist"),
    presale_hero_image_url: (row.presale_hero_image_url as string | null) ?? null,
    maintenance_hero_image_url: (row.maintenance_hero_image_url as string | null) ?? null,
    launch_hero_image_url: (row.launch_hero_image_url as string | null) ?? null,
    instagram_url: (row.instagram_url as string | null) ?? null,
    whatsapp_url: (row.whatsapp_url as string | null) ?? null,
    private_access_password_hash: (row.private_access_password_hash as string | null) ?? null,
    private_access_ips: Array.isArray(row.private_access_ips)
      ? (row.private_access_ips as string[])
      : [],
    scheduled_activate_at: (row.scheduled_activate_at as string | null) ?? null,
    scheduled_deactivate_at: (row.scheduled_deactivate_at as string | null) ?? null,
    scheduled_status: isStoreStatus(row.scheduled_status) ? row.scheduled_status : null,
    scheduled_timezone: String(row.scheduled_timezone ?? "Africa/Accra"),
    revert_status: isStoreStatus(row.revert_status) ? row.revert_status : "live",
    show_waitlist_count: row.show_waitlist_count !== false,
    maintenance_use_503: Boolean(row.maintenance_use_503),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listStoreBanners(): Promise<StoreBannerRow[]> {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("store_banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as StoreBannerRow[];
}

/** Turn off scheduled + legacy announcement strips when the boutique goes live. Returns the error message, if any. */
async function clearAnnouncementBannersOnLive(
  service: ReturnType<typeof createServiceRoleClient>
): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await service
    .from("store_banners")
    .update({ enabled: false, updated_at: now })
    .eq("enabled", true);
  return error?.message ?? null;
}

async function readSettingsRow(
  service: ReturnType<typeof createServiceRoleClient>
): Promise<{ row: StoreSettingsRow | null; error: string | null }> {
  const { data, error } = await service
    .from("store_settings")
    .select(SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();
  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "store_settings row missing" };
  return { row: mapSettingsRow(data as Record<string, unknown>), error: null };
}

export async function getStoreSettingsRow(): Promise<StoreSettingsRow | null> {
  return (await readSettingsRow(createServiceRoleClient())).row;
}

/**
 * - persisted: the conditional UPDATE matched; side effects ran.
 * - reconciled: the UPDATE returned an error but a re-read confirmed it committed; side effects ran.
 * - lost_race: the UPDATE matched no row (a newer decision or another save won).
 * - error: the UPDATE returned an error and the re-read shows it did not commit (or was superseded).
 * - error_unverified: the UPDATE returned an error and the re-read failed; the outcome is unknown.
 */
export type ScheduledPersistOutcome =
  | "not_due"
  | "persisted"
  | "reconciled"
  | "lost_race"
  | "error"
  | "error_unverified";

export type ScheduledPersistResult = {
  settings: StoreSettingsRow;
  outcome: ScheduledPersistOutcome;
  /** The effective result is a scheduled go-live: render without announcement banners. */
  hideBanners: boolean;
  /** False when the current authoritative row could not be read: `settings` is an in-memory guess. */
  verified: boolean;
  /** Set when side effects ran: "failed" if banner clearing or the site_settings sync errored. */
  sideEffects?: "completed" | "failed";
};

/** Epoch microseconds, so Postgres (`…123456+00:00`) and JS (`…123Z`) forms compare by instant. */
export function timestampMicros(value: string | null): number | null {
  if (value === null) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const fraction = /T\d{2}:\d{2}:\d{2}\.(\d+)/.exec(value)?.[1] ?? /\s\d{2}:\d{2}:\d{2}\.(\d+)/.exec(value)?.[1] ?? "";
  const subMs = Number(fraction.slice(3, 6).padEnd(3, "0"));
  return ms * 1000 + subMs;
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  const ma = timestampMicros(a);
  return ma !== null && ma === timestampMicros(b);
}

/**
 * The transition timestamp plus a random non-zero microsecond suffix. App writes
 * elsewhere use millisecond precision (suffix 000), so a later admin write can
 * never carry this exact instant.
 */
function transitionWriteStamp(updatedAt: string): string {
  return updatedAt.replace(/Z$/, `${String(randomInt(1, 1000)).padStart(3, "0")}+00:00`);
}

/** True only if `row` is exactly the state this save wrote, including its unique stamp. */
function confirmsTransition(row: StoreSettingsRow, written: StoreSettingsRow, goingLive: boolean): boolean {
  return (
    sameInstant(row.updated_at, written.updated_at) &&
    row.store_status === written.store_status &&
    row.browsing_enabled === written.browsing_enabled &&
    row.checkout_enabled === written.checkout_enabled &&
    row.scheduled_status === written.scheduled_status &&
    sameInstant(row.scheduled_activate_at, written.scheduled_activate_at) &&
    sameInstant(row.scheduled_deactivate_at, written.scheduled_deactivate_at) &&
    (!goingLive || row.banner_enabled === false)
  );
}

/**
 * Banner clearing and the site_settings sync. Both are idempotent value updates;
 * they run once per confirmed save and failures are logged, not retried.
 */
async function runScheduledSideEffects(
  service: ReturnType<typeof createServiceRoleClient>,
  written: StoreSettingsRow,
  goingLive: boolean
): Promise<"completed" | "failed"> {
  let failed = false;
  if (goingLive) {
    const bannerError = await clearAnnouncementBannersOnLive(service);
    if (bannerError) {
      failed = true;
      console.error("[store-control] scheduled go-live: clearing announcement banners failed:", bannerError);
    }
  }
  const { error } = await service
    .from("site_settings")
    .update({
      maintenance_mode: written.store_status !== "live" && !written.browsing_enabled,
      updated_at: written.updated_at,
    })
    .eq("id", 1);
  if (error) {
    failed = true;
    console.error("[store-control] scheduled transition: site_settings sync failed:", error.message);
  }
  return failed ? "failed" : "completed";
}

/** Effective in-memory state from a re-read row, hiding banners if it is a scheduled go-live. */
function resolveFromFreshRow(
  fresh: StoreSettingsRow,
  goingLive: boolean,
  outcome: ScheduledPersistOutcome
): ScheduledPersistResult {
  const { settings, changed } = applyScheduledTransitions(fresh);
  const hideBanners = settings.store_status === "live" && (goingLive || changed);
  return {
    settings: hideBanners ? { ...settings, banner_enabled: false } : settings,
    outcome,
    hideBanners,
    verified: true,
  };
}

/**
 * Persist a due scheduled transition with a conditional UPDATE: it only applies
 * if every column the transition reads or writes still holds the value in
 * `settings` (which must be the row read immediately before). A concurrent save,
 * admin write or out-of-app edit therefore makes it match zero rows instead of
 * overwriting the newer decision. Banner clearing and the site_settings sync run
 * only when exactly one row matched, or when a re-read after an UPDATE error
 * confirms this exact save committed.
 */
export async function persistScheduledIfDue(settings: StoreSettingsRow): Promise<ScheduledPersistResult> {
  const transition = applyScheduledTransitions(settings);
  if (!transition.changed) return { settings, outcome: "not_due", hideBanners: false, verified: true };

  const service = createServiceRoleClient();
  const goingLive = transition.settings.store_status === "live";
  const next: StoreSettingsRow = {
    ...transition.settings,
    updated_at: transitionWriteStamp(transition.settings.updated_at),
  };
  const nextView: StoreSettingsRow = goingLive ? { ...next, banner_enabled: false } : next;
  let update = service
    .from("store_settings")
    .update({
      store_status: next.store_status,
      browsing_enabled: next.browsing_enabled,
      checkout_enabled: next.checkout_enabled,
      scheduled_activate_at: next.scheduled_activate_at,
      scheduled_deactivate_at: next.scheduled_deactivate_at,
      scheduled_status: next.scheduled_status,
      ...(goingLive ? { banner_enabled: false } : {}),
      updated_at: next.updated_at,
    })
    .eq("id", 1)
    // Raw values as read: timestamps must not be re-formatted (microseconds).
    .eq("updated_at", settings.updated_at)
    .eq("store_status", settings.store_status)
    .eq("browsing_enabled", settings.browsing_enabled)
    .eq("checkout_enabled", settings.checkout_enabled)
    .eq("revert_status", settings.revert_status);
  update =
    settings.scheduled_activate_at === null
      ? update.is("scheduled_activate_at", null)
      : update.eq("scheduled_activate_at", settings.scheduled_activate_at);
  update =
    settings.scheduled_status === null
      ? update.is("scheduled_status", null)
      : update.eq("scheduled_status", settings.scheduled_status);
  update =
    settings.scheduled_deactivate_at === null
      ? update.is("scheduled_deactivate_at", null)
      : update.eq("scheduled_deactivate_at", settings.scheduled_deactivate_at);
  if (goingLive) update = update.eq("banner_enabled", settings.banner_enabled);

  const { data, error } = await update.select("id");

  if (error) {
    // The UPDATE may have committed with the response lost: reconcile from a re-read.
    console.error("[store-control] scheduled transition save returned an error; reconciling:", error.message);
    const reread = await readSettingsRow(service);
    if (!reread.row) {
      console.error(
        "[store-control] scheduled transition reconciliation read failed; save outcome unknown, side effects not run:",
        reread.error
      );
      return { settings: nextView, outcome: "error_unverified", hideBanners: goingLive, verified: false };
    }
    if (confirmsTransition(reread.row, next, goingLive)) {
      const sideEffects = await runScheduledSideEffects(service, next, goingLive);
      return { settings: nextView, outcome: "reconciled", hideBanners: goingLive, verified: true, sideEffects };
    }
    return resolveFromFreshRow(reread.row, goingLive, "error");
  }

  if (!data || data.length !== 1) {
    // Another save or a newer decision changed the row first. Resolve from the
    // current row without attempting another save in this request.
    const reread = await readSettingsRow(service);
    if (!reread.row) {
      console.error(
        "[store-control] scheduled transition lost a race and the re-read failed; current store state unknown:",
        reread.error
      );
      return { settings: nextView, outcome: "lost_race", hideBanners: goingLive, verified: false };
    }
    return resolveFromFreshRow(reread.row, goingLive, "lost_race");
  }

  const sideEffects = await runScheduledSideEffects(service, next, goingLive);
  return { settings: nextView, outcome: "persisted", hideBanners: goingLive, verified: true, sideEffects };
}

/** `wrote`: this call saved (or, when unverified, may have saved) a scheduled transition. */
export type SettleResult =
  | { ok: true; settings: StoreSettingsRow; wrote: boolean }
  | { ok: false; reason: "unavailable" | "unverified" | "conflict"; error: string; wrote: boolean };

/**
 * Settle any overdue scheduled transition from fresh authoritative reads, using
 * the guarded save, before an administrator writes the store state. At most
 * `maxAttempts` read-and-save rounds; never reports success on unknown state.
 */
export async function settleDueSchedule(maxAttempts = 3): Promise<SettleResult> {
  const service = createServiceRoleClient();
  let saveFailed = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const read = await readSettingsRow(service);
    if (!read.row) {
      console.error("[store-control] schedule settling: settings read failed:", read.error);
      return { ok: false, reason: "unavailable", error: read.error ?? "settings read failed", wrote: false };
    }
    const result = await persistScheduledIfDue(read.row);
    switch (result.outcome) {
      case "not_due":
        return { ok: true, settings: read.row, wrote: false };
      case "persisted":
      case "reconciled":
        return { ok: true, settings: result.settings, wrote: true };
      case "error_unverified":
        return { ok: false, reason: "unverified", error: "scheduled transition outcome unknown", wrote: true };
      case "error":
        // The save failed and the re-read shows it did not commit: retry within the bound.
        saveFailed = true;
        continue;
      case "lost_race":
        // Another save or a newer write got there first: re-read and retry.
        continue;
    }
  }
  if (saveFailed) {
    console.error(`[store-control] schedule settling: scheduled save failed; not settled after ${maxAttempts} attempts`);
    return { ok: false, reason: "unavailable", error: "scheduled transition save failed", wrote: false };
  }
  console.error(`[store-control] schedule settling: still not settled after ${maxAttempts} attempts`);
  return { ok: false, reason: "conflict", error: "schedule could not be settled", wrote: false };
}

type StoreWriteFailure = { ok: false; status: 400 | 409 | 500 | 503; code: string; error: string };

function settleFailure(settle: Extract<SettleResult, { ok: false }>): StoreWriteFailure {
  return settle.reason === "conflict"
    ? {
        ok: false,
        status: 409,
        code: "schedule_settle_conflict",
        error: "A scheduled store change is being applied right now. Please try again.",
      }
    : {
        ok: false,
        status: 503,
        code: "store_state_unavailable",
        error: "Store settings are temporarily unavailable. Please try again in a moment.",
      };
}

/**
 * Superadmin maintenance toggle: settle overdue schedules first, then set the
 * status and its recommended flags. Nothing is written if settling fails.
 */
export async function applySuperadminMaintenanceStatus(
  maintenanceMode: boolean
): Promise<{ ok: true; settled: boolean } | (StoreWriteFailure & { settled: boolean })> {
  const settle = await settleDueSchedule();
  if (!settle.ok) return { ...settleFailure(settle), settled: settle.wrote };

  const status = maintenanceMode ? "maintenance" : "live";
  const flags = recommendedFlagsForStatus(status);
  const { error } = await createServiceRoleClient()
    .from("store_settings")
    .update({
      store_status: status,
      browsing_enabled: flags.browsing_enabled,
      checkout_enabled: flags.checkout_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    console.error("[store-control] superadmin store status update failed:", error.message);
    return {
      ok: false,
      status: 500,
      code: "store_settings_update_failed",
      error: "Could not update the store status. No changes were saved.",
      settled: settle.wrote,
    };
  }
  return { ok: true, settled: settle.wrote };
}

type EffectiveStoreControlOptions = {
  /**
   * Decides from the effective settings whether the waitlist count is displayed.
   * When it returns false the count query is skipped and `waitlistCount` is 0.
   * Omitted: the count is always fetched.
   */
  includeWaitlistCount?: (control: EffectiveStoreControl) => boolean;
};

/** Effective control for display; falls back to live defaults when the settings row cannot be read. */
export async function getEffectiveStoreControl(
  options?: EffectiveStoreControlOptions
): Promise<EffectiveStoreControl> {
  return (await loadEffectiveStoreControl(options)).control;
}

/**
 * Effective control plus whether it reflects the authoritative row. `verified`
 * is false when the settings read failed or the row is missing (display
 * defaults), or when a scheduled save left the current state unknown.
 */
export async function loadEffectiveStoreControl(
  options?: EffectiveStoreControlOptions
): Promise<{ control: EffectiveStoreControl; verified: boolean }> {
  const read = await readSettingsRow(createServiceRoleClient());
  if (!read.row) {
    return {
      control: resolveEffectiveStoreControl(defaultSettings(), [], { waitlistCount: 0 }),
      verified: false,
    };
  }
  const scheduled = await persistScheduledIfDue(read.row);
  const settings = scheduled.settings;
  const needsWaitlistCount = options?.includeWaitlistCount
    ? options.includeWaitlistCount(resolveEffectiveStoreControl(settings))
    : true;
  const [banners, waitlistCount] = await Promise.all([
    // A scheduled go-live disables every announcement banner; reflect it now even
    // if the banner write lost a race, failed, or has not landed yet.
    scheduled.hideBanners ? Promise.resolve([] as StoreBannerRow[]) : listStoreBanners(),
    needsWaitlistCount ? getWaitlistCount() : Promise.resolve(0),
  ]);
  return {
    control: resolveEffectiveStoreControl(settings, banners, { waitlistCount }),
    verified: scheduled.verified,
  };
}

function defaultSettings(): StoreSettingsRow {
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
    updated_at: new Date().toISOString(),
  };
}

export const STORE_STATE_UNAVAILABLE_RETRY_SECONDS = 30;
export const STORE_CHECKOUT_DISABLED_RETRY_SECONDS = 3600;

/**
 * Authoritative checkout gate. Fails closed: if the store state cannot be
 * verified, checkout is refused with a short retry rather than allowed.
 */
export async function assertCheckoutAllowed(): Promise<
  | { ok: true; control: EffectiveStoreControl }
  | { ok: false; status: number; error: string; code: string; retryAfterSeconds: number }
> {
  const { control, verified } = await loadEffectiveStoreControl({ includeWaitlistCount: () => false });
  if (!verified) {
    console.error("[store-control] checkout refused: store state could not be verified");
    return {
      ok: false,
      status: 503,
      error: "Checkout is temporarily unavailable. Please try again in a moment.",
      code: "store_state_unavailable",
      retryAfterSeconds: STORE_STATE_UNAVAILABLE_RETRY_SECONDS,
    };
  }
  if (!control.checkoutAllowed) {
    return {
      ok: false,
      status: 503,
      error: control.maintenanceMessage,
      code: "store_checkout_disabled",
      retryAfterSeconds: STORE_CHECKOUT_DISABLED_RETRY_SECONDS,
    };
  }
  return { ok: true, control };
}

export type StoreControlPatch = Partial<{
  store_status: StoreStatus;
  maintenance_message: string | null;
  supporting_message: string | null;
  reopening_date: string | null;
  presale_date: string | null;
  launch_date: string | null;
  banner_text: string | null;
  banner_enabled: boolean;
  checkout_enabled: boolean;
  browsing_enabled: boolean;
  countdown_enabled: boolean;
  presale_cta_label: string;
  presale_hero_image_url: string | null;
  maintenance_hero_image_url: string | null;
  launch_hero_image_url: string | null;
  instagram_url: string | null;
  whatsapp_url: string | null;
  private_access_password: string | null;
  private_access_ips: string[];
  scheduled_activate_at: string | null;
  scheduled_deactivate_at: string | null;
  scheduled_status: StoreStatus | null;
  scheduled_timezone: string;
  revert_status: StoreStatus;
  show_waitlist_count: boolean;
  maintenance_use_503: boolean;
  apply_recommended_flags: boolean;
}>;

export function parseStoreControlPatch(
  body: unknown
):
  | { ok: true; patch: StoreControlPatch; expectedUpdatedAt: string | null }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const patch: StoreControlPatch = {};

  let expectedUpdatedAt: string | null = null;
  if ("expected_updated_at" in b && b.expected_updated_at !== null) {
    if (typeof b.expected_updated_at !== "string" || timestampMicros(b.expected_updated_at) === null) {
      return { ok: false, error: "Invalid expected_updated_at" };
    }
    expectedUpdatedAt = b.expected_updated_at;
  }

  if ("store_status" in b) {
    if (!isStoreStatus(b.store_status)) return { ok: false, error: "Invalid store_status" };
    patch.store_status = b.store_status;
    if (b.apply_recommended_flags !== false) {
      Object.assign(patch, recommendedFlagsForStatus(b.store_status));
    }
  }

  const stringOrNull = (key: string) => {
    if (!(key in b)) return;
    if (b[key] === null) {
      (patch as Record<string, unknown>)[key] = null;
      return;
    }
    if (typeof b[key] === "string") {
      (patch as Record<string, unknown>)[key] = b[key];
    }
  };

  stringOrNull("maintenance_message");
  stringOrNull("supporting_message");
  stringOrNull("reopening_date");
  stringOrNull("presale_hero_image_url");
  stringOrNull("maintenance_hero_image_url");
  stringOrNull("launch_hero_image_url");
  stringOrNull("scheduled_timezone");
  stringOrNull("presale_date");
  stringOrNull("launch_date");
  stringOrNull("banner_text");
  stringOrNull("instagram_url");
  stringOrNull("whatsapp_url");
  stringOrNull("scheduled_activate_at");
  stringOrNull("scheduled_deactivate_at");
  stringOrNull("presale_cta_label");

  if ("scheduled_status" in b) {
    if (b.scheduled_status === null) patch.scheduled_status = null;
    else if (isStoreStatus(b.scheduled_status)) patch.scheduled_status = b.scheduled_status;
    else return { ok: false, error: "Invalid scheduled_status" };
  }

  if ("revert_status" in b && isStoreStatus(b.revert_status)) {
    patch.revert_status = b.revert_status;
  }

  for (const key of [
    "banner_enabled",
    "checkout_enabled",
    "browsing_enabled",
    "countdown_enabled",
    "show_waitlist_count",
    "maintenance_use_503",
  ] as const) {
    if (key in b && typeof b[key] === "boolean") patch[key] = b[key];
  }

  if ("private_access_ips" in b && Array.isArray(b.private_access_ips)) {
    patch.private_access_ips = b.private_access_ips
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  if ("private_access_password" in b) {
    if (b.private_access_password === null || b.private_access_password === "") {
      patch.private_access_password = null;
    } else if (typeof b.private_access_password === "string") {
      patch.private_access_password = b.private_access_password;
    }
  }

  if (!Object.keys(patch).length) return { ok: false, error: "No valid fields to update" };
  return { ok: true, patch, expectedUpdatedAt };
}

/** Fields that arm or change a scheduled transition; saving them requires `expected_updated_at`. */
const SCHEDULE_FIELDS = ["scheduled_activate_at", "scheduled_deactivate_at", "scheduled_status", "revert_status"] as const;

/**
 * Rejects schedule times that are changed to (or armed in) the past, so a stale
 * form cannot re-arm a transition that already ran. Values equal to the stored
 * ones are treated as unchanged and allowed.
 */
function scheduleChangeError(patch: StoreControlPatch, current: StoreSettingsRow, now: number): string | null {
  for (const key of ["scheduled_activate_at", "scheduled_deactivate_at"] as const) {
    const value = patch[key];
    if (typeof value === "string" && timestampMicros(value) === null) return `Invalid ${key}`;
  }
  const activateAt = patch.scheduled_activate_at !== undefined ? patch.scheduled_activate_at : current.scheduled_activate_at;
  const status = patch.scheduled_status !== undefined ? patch.scheduled_status : current.scheduled_status;
  const activateChanged =
    patch.scheduled_activate_at !== undefined && !sameInstant(patch.scheduled_activate_at, current.scheduled_activate_at);
  const statusChanged = patch.scheduled_status !== undefined && patch.scheduled_status !== current.scheduled_status;
  if (activateAt !== null && Date.parse(activateAt) <= now) {
    if (activateChanged) return "The scheduled activation time is in the past. Choose a future time.";
    if (statusChanged && status !== null) {
      return "The scheduled activation time is in the past. Choose a future time before setting a target mode.";
    }
  }
  const deactivateAt = patch.scheduled_deactivate_at;
  if (
    typeof deactivateAt === "string" &&
    !sameInstant(deactivateAt, current.scheduled_deactivate_at) &&
    Date.parse(deactivateAt) <= now
  ) {
    return "The scheduled revert time is in the past. Choose a future time.";
  }
  return null;
}

export type PatchStoreSettingsResult =
  | { ok: true; settings: StoreSettingsRow; control: EffectiveStoreControl; settled: boolean }
  | (StoreWriteFailure & { settled: boolean });

/**
 * Admin store-control write. Overdue scheduled transitions are settled first so
 * the administrator's newer decision lands after them; nothing is written if
 * that cannot be done safely. Schedule saves must carry `expectedUpdatedAt`
 * (the raw `updated_at` the form was loaded with) and are rejected with 409 if
 * the row changed since, including by a scheduled transition.
 */
export async function patchStoreSettings(
  patch: StoreControlPatch,
  options: { expectedUpdatedAt?: string | null } = {}
): Promise<PatchStoreSettingsResult> {
  const expectedUpdatedAt = options.expectedUpdatedAt ?? null;
  const scheduleSave = SCHEDULE_FIELDS.some((key) => patch[key] !== undefined);
  if (scheduleSave && !expectedUpdatedAt) {
    return {
      ok: false,
      status: 400,
      code: "expected_updated_at_required",
      error: "Reload the store controls before saving the schedule.",
      settled: false,
    };
  }

  const settle = await settleDueSchedule();
  if (!settle.ok) return { ...settleFailure(settle), settled: settle.wrote };
  const settled = settle.wrote;
  const current = settle.settings;

  const settingsChanged: StoreWriteFailure & { settled: boolean } = {
    ok: false,
    status: 409,
    code: "settings_changed",
    error:
      "Store settings changed since you loaded them (a scheduled change may have run). Reload to see the latest settings, then reapply your schedule changes.",
    settled,
  };
  if (expectedUpdatedAt && !sameInstant(expectedUpdatedAt, current.updated_at)) return settingsChanged;

  const scheduleError = scheduleChangeError(patch, current, Date.now());
  if (scheduleError) {
    return { ok: false, status: 400, code: "schedule_in_past", error: scheduleError, settled };
  }

  const service = createServiceRoleClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.store_status !== undefined) update.store_status = patch.store_status;
  if (patch.maintenance_message !== undefined) update.maintenance_message = patch.maintenance_message;
  if (patch.supporting_message !== undefined) update.supporting_message = patch.supporting_message;
  if (patch.reopening_date !== undefined) update.reopening_date = patch.reopening_date;
  if (patch.presale_date !== undefined) update.presale_date = patch.presale_date;
  if (patch.launch_date !== undefined) update.launch_date = patch.launch_date;
  if (patch.banner_text !== undefined) update.banner_text = patch.banner_text;
  if (patch.banner_enabled !== undefined) update.banner_enabled = patch.banner_enabled;
  if (patch.checkout_enabled !== undefined) update.checkout_enabled = patch.checkout_enabled;
  if (patch.browsing_enabled !== undefined) update.browsing_enabled = patch.browsing_enabled;
  if (patch.countdown_enabled !== undefined) update.countdown_enabled = patch.countdown_enabled;
  if (patch.presale_cta_label !== undefined) update.presale_cta_label = patch.presale_cta_label.trim();
  if (patch.presale_hero_image_url !== undefined) update.presale_hero_image_url = patch.presale_hero_image_url;
  if (patch.maintenance_hero_image_url !== undefined) {
    update.maintenance_hero_image_url = patch.maintenance_hero_image_url;
  }
  if (patch.launch_hero_image_url !== undefined) update.launch_hero_image_url = patch.launch_hero_image_url;
  if (patch.scheduled_timezone !== undefined) update.scheduled_timezone = patch.scheduled_timezone.trim();
  if (patch.show_waitlist_count !== undefined) update.show_waitlist_count = patch.show_waitlist_count;
  if (patch.maintenance_use_503 !== undefined) update.maintenance_use_503 = patch.maintenance_use_503;
  if (patch.instagram_url !== undefined) update.instagram_url = patch.instagram_url;
  if (patch.whatsapp_url !== undefined) update.whatsapp_url = patch.whatsapp_url;
  if (patch.scheduled_activate_at !== undefined) update.scheduled_activate_at = patch.scheduled_activate_at;
  if (patch.scheduled_deactivate_at !== undefined) update.scheduled_deactivate_at = patch.scheduled_deactivate_at;
  if (patch.scheduled_status !== undefined) update.scheduled_status = patch.scheduled_status;
  if (patch.revert_status !== undefined) update.revert_status = patch.revert_status;
  if (patch.private_access_ips !== undefined) update.private_access_ips = patch.private_access_ips;

  if (patch.private_access_password !== undefined) {
    update.private_access_password_hash =
      patch.private_access_password === null
        ? null
        : hashPrivateAccessPassword(patch.private_access_password);
  }

  const goingLive = patch.store_status === "live";
  if (goingLive) {
    update.banner_enabled = false;
  }

  let query = service.from("store_settings").update(update).eq("id", 1);
  // Atomic version check: the raw timestamp the form was loaded with.
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await query.select(SETTINGS_SELECT);

  if (error || !data || data.length !== 1) {
    if (!error && expectedUpdatedAt) return settingsChanged;
    console.error("[store-control] admin store settings update failed:", error?.message ?? "no row updated");
    return {
      ok: false,
      status: 500,
      code: "store_settings_update_failed",
      error: "Could not save store settings",
      settled,
    };
  }

  if (goingLive) {
    await clearAnnouncementBannersOnLive(service);
  }

  const settings = mapSettingsRow(data[0] as Record<string, unknown>);

  await service
    .from("site_settings")
    .update({
      maintenance_mode: settings.store_status !== "live" && !settings.browsing_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  const [banners, waitlistCount] = await Promise.all([listStoreBanners(), getWaitlistCount()]);
  return {
    ok: true,
    settings,
    control: resolveEffectiveStoreControl(settings, banners, { waitlistCount }),
    settled,
  };
}

export async function getStoreControlAdminSnapshot() {
  const settings = await getStoreSettingsRow();
  const banners = await listStoreBanners();
  const service = createServiceRoleClient();
  const { data: whitelist } = await service
    .from("store_access_whitelist")
    .select("id, email, note, created_at")
    .order("created_at", { ascending: false });

  const row = settings ?? defaultSettings();
  const [waitlistCount, analytics] = await Promise.all([getWaitlistCount(), getStoreControlAnalytics()]);
  return {
    settings: row,
    control: resolveEffectiveStoreControl(row, banners, { waitlistCount }),
    banners,
    whitelist: (whitelist ?? []) as Array<{ id: string; email: string; note: string | null; created_at: string }>,
    analytics,
    waitlistCount,
  };
}
