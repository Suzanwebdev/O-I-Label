import { createClient } from "@supabase/supabase-js";
import {
  applyScheduledTransitions,
  resolveEffectiveStoreControl,
} from "@/lib/store-control/resolve";
import type { EffectiveStoreControl, StoreBannerRow, StoreSettingsRow } from "@/lib/store-control/types";
import { isStoreStatus } from "@/lib/store-control/resolve";

type CacheEntry = { at: number; control: EffectiveStoreControl; settings: StoreSettingsRow };
let cache: CacheEntry | null = null;
const TTL_MS = 15_000;

function edgeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function mapRow(row: Record<string, unknown>): StoreSettingsRow {
  return {
    id: 1,
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
    private_access_ips: Array.isArray(row.private_access_ips) ? (row.private_access_ips as string[]) : [],
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

export async function getStoreControlEdgeCached(): Promise<{
  control: EffectiveStoreControl;
  settings: StoreSettingsRow;
}> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { control: cache.control, settings: cache.settings };
  }

  const supabase = edgeSupabase();
  if (!supabase) {
    const settings: StoreSettingsRow = {
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
    const control = resolveEffectiveStoreControl(settings, []);
    cache = { at: Date.now(), control, settings };
    return { control, settings };
  }

  const [{ data: settingsData }, { data: bannersData }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("store_banners").select("*").order("sort_order"),
  ]);

  const settings = applyScheduledTransitions(
    mapRow((settingsData ?? { store_status: "live" }) as Record<string, unknown>)
  ).settings;

  const banners = (bannersData ?? []) as StoreBannerRow[];
  const control = resolveEffectiveStoreControl(settings, banners);
  cache = { at: Date.now(), control, settings };
  return { control, settings };
}

export function invalidateStoreControlEdgeCache() {
  cache = null;
}
