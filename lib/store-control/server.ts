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
import { recommendedFlagsForStatus } from "@/lib/store-control/constants";

const SETTINGS_SELECT =
  "id, store_status, maintenance_message, reopening_date, presale_date, launch_date, banner_text, banner_enabled, checkout_enabled, browsing_enabled, countdown_enabled, presale_cta_label, instagram_url, whatsapp_url, private_access_password_hash, private_access_ips, scheduled_activate_at, scheduled_deactivate_at, scheduled_status, revert_status, updated_at";

function mapSettingsRow(row: Record<string, unknown>): StoreSettingsRow {
  return {
    id: Number(row.id ?? 1),
    store_status: isStoreStatus(row.store_status) ? row.store_status : "live",
    maintenance_message: (row.maintenance_message as string | null) ?? null,
    reopening_date: (row.reopening_date as string | null) ?? null,
    presale_date: (row.presale_date as string | null) ?? null,
    launch_date: (row.launch_date as string | null) ?? null,
    banner_text: (row.banner_text as string | null) ?? null,
    banner_enabled: Boolean(row.banner_enabled),
    checkout_enabled: Boolean(row.checkout_enabled),
    browsing_enabled: Boolean(row.browsing_enabled),
    countdown_enabled: Boolean(row.countdown_enabled),
    presale_cta_label: String(row.presale_cta_label ?? "Join waitlist"),
    instagram_url: (row.instagram_url as string | null) ?? null,
    whatsapp_url: (row.whatsapp_url as string | null) ?? null,
    private_access_password_hash: (row.private_access_password_hash as string | null) ?? null,
    private_access_ips: Array.isArray(row.private_access_ips)
      ? (row.private_access_ips as string[])
      : [],
    scheduled_activate_at: (row.scheduled_activate_at as string | null) ?? null,
    scheduled_deactivate_at: (row.scheduled_deactivate_at as string | null) ?? null,
    scheduled_status: isStoreStatus(row.scheduled_status) ? row.scheduled_status : null,
    revert_status: isStoreStatus(row.revert_status) ? row.revert_status : "live",
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

export async function getStoreSettingsRow(): Promise<StoreSettingsRow | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("store_settings")
    .select(SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  return mapSettingsRow(data as Record<string, unknown>);
}

export async function persistScheduledIfDue(settings: StoreSettingsRow): Promise<StoreSettingsRow> {
  const { settings: next, changed } = applyScheduledTransitions(settings);
  if (!changed) return settings;

  const service = createServiceRoleClient();
  await service
    .from("store_settings")
    .update({
      store_status: next.store_status,
      browsing_enabled: next.browsing_enabled,
      checkout_enabled: next.checkout_enabled,
      scheduled_activate_at: next.scheduled_activate_at,
      scheduled_deactivate_at: next.scheduled_deactivate_at,
      scheduled_status: next.scheduled_status,
      updated_at: next.updated_at,
    })
    .eq("id", 1);

  await service
    .from("site_settings")
    .update({
      maintenance_mode: next.store_status !== "live" && !next.browsing_enabled,
      updated_at: next.updated_at,
    })
    .eq("id", 1);

  return next;
}

export async function getEffectiveStoreControl(): Promise<EffectiveStoreControl> {
  let settings = await getStoreSettingsRow();
  if (!settings) {
    return resolveEffectiveStoreControl(defaultSettings(), []);
  }
  settings = await persistScheduledIfDue(settings);
  const banners = await listStoreBanners();
  return resolveEffectiveStoreControl(settings, banners);
}

function defaultSettings(): StoreSettingsRow {
  return {
    id: 1,
    store_status: "live",
    maintenance_message: null,
    reopening_date: null,
    presale_date: null,
    launch_date: null,
    banner_text: null,
    banner_enabled: false,
    checkout_enabled: true,
    browsing_enabled: true,
    countdown_enabled: false,
    presale_cta_label: "Join waitlist",
    instagram_url: null,
    whatsapp_url: null,
    private_access_password_hash: null,
    private_access_ips: [],
    scheduled_activate_at: null,
    scheduled_deactivate_at: null,
    scheduled_status: null,
    revert_status: "live",
    updated_at: new Date().toISOString(),
  };
}

export async function assertCheckoutAllowed(): Promise<
  | { ok: true; control: EffectiveStoreControl }
  | { ok: false; status: number; error: string; code: string }
> {
  const control = await getEffectiveStoreControl();
  if (!control.checkoutAllowed) {
    return {
      ok: false,
      status: 503,
      error: control.maintenanceMessage,
      code: "store_checkout_disabled",
    };
  }
  return { ok: true, control };
}

export type StoreControlPatch = Partial<{
  store_status: StoreStatus;
  maintenance_message: string | null;
  reopening_date: string | null;
  presale_date: string | null;
  launch_date: string | null;
  banner_text: string | null;
  banner_enabled: boolean;
  checkout_enabled: boolean;
  browsing_enabled: boolean;
  countdown_enabled: boolean;
  presale_cta_label: string;
  instagram_url: string | null;
  whatsapp_url: string | null;
  private_access_password: string | null;
  private_access_ips: string[];
  scheduled_activate_at: string | null;
  scheduled_deactivate_at: string | null;
  scheduled_status: StoreStatus | null;
  revert_status: StoreStatus;
  apply_recommended_flags: boolean;
}>;

export function parseStoreControlPatch(body: unknown): { ok: true; patch: StoreControlPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const patch: StoreControlPatch = {};

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
  stringOrNull("reopening_date");
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

  for (const key of ["banner_enabled", "checkout_enabled", "browsing_enabled", "countdown_enabled"] as const) {
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
  return { ok: true, patch };
}

export async function patchStoreSettings(
  patch: StoreControlPatch
): Promise<{ settings: StoreSettingsRow; control: EffectiveStoreControl } | null> {
  const service = createServiceRoleClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.store_status !== undefined) update.store_status = patch.store_status;
  if (patch.maintenance_message !== undefined) update.maintenance_message = patch.maintenance_message;
  if (patch.reopening_date !== undefined) update.reopening_date = patch.reopening_date;
  if (patch.presale_date !== undefined) update.presale_date = patch.presale_date;
  if (patch.launch_date !== undefined) update.launch_date = patch.launch_date;
  if (patch.banner_text !== undefined) update.banner_text = patch.banner_text;
  if (patch.banner_enabled !== undefined) update.banner_enabled = patch.banner_enabled;
  if (patch.checkout_enabled !== undefined) update.checkout_enabled = patch.checkout_enabled;
  if (patch.browsing_enabled !== undefined) update.browsing_enabled = patch.browsing_enabled;
  if (patch.countdown_enabled !== undefined) update.countdown_enabled = patch.countdown_enabled;
  if (patch.presale_cta_label !== undefined) update.presale_cta_label = patch.presale_cta_label.trim();
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

  const { data, error } = await service
    .from("store_settings")
    .update(update)
    .eq("id", 1)
    .select(SETTINGS_SELECT)
    .single();

  if (error || !data) return null;

  const settings = mapSettingsRow(data as Record<string, unknown>);

  await service
    .from("site_settings")
    .update({
      maintenance_mode: settings.store_status !== "live" && !settings.browsing_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  const banners = await listStoreBanners();
  return { settings, control: resolveEffectiveStoreControl(settings, banners) };
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
  return {
    settings: row,
    control: resolveEffectiveStoreControl(row, banners),
    banners,
    whitelist: (whitelist ?? []) as Array<{ id: string; email: string; note: string | null; created_at: string }>,
  };
}
