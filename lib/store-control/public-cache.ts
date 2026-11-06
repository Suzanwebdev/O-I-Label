import { unstable_cache } from "next/cache";
import {
  PUBLIC_CACHE_TAGS,
  STORE_CONTROL_CACHE_SECONDS,
  publicCacheKeyParts,
} from "@/lib/cache/public-catalogue";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { applyScheduledTransitions, resolveEffectiveStoreControl } from "@/lib/store-control/resolve";
import { getEffectiveStoreControl, mapSettingsRow } from "@/lib/store-control/server";
import type { EffectiveStoreControl, StoreBannerRow, StoreSettingsRow } from "@/lib/store-control/types";
import { getWaitlistCount } from "@/lib/store-control/waitlist";

/**
 * Columns of the anon-readable `store_settings_public` view. The view (and this
 * list) excludes private_access_password_hash and private_access_ips.
 */
export const PUBLIC_STORE_SETTINGS_COLUMNS =
  "id, store_status, maintenance_message, supporting_message, reopening_date, presale_date, launch_date, banner_text, banner_enabled, checkout_enabled, browsing_enabled, countdown_enabled, presale_cta_label, presale_hero_image_url, maintenance_hero_image_url, launch_hero_image_url, instagram_url, whatsapp_url, scheduled_activate_at, scheduled_deactivate_at, scheduled_status, scheduled_timezone, revert_status, show_waitlist_count, maintenance_use_503, updated_at";

export const PUBLIC_STORE_BANNER_COLUMNS =
  "id, text, href, enabled, starts_at, ends_at, sort_order, created_at, updated_at";

/**
 * Part of every cache key: entries are only reused within one window, so data
 * changed outside the admin API (which cannot expire tags) is at most one window
 * old — unlike `revalidate`, which serves a stale entry once before refreshing.
 */
export function storeControlCacheBucket(now = Date.now()): number {
  return Math.floor(now / (STORE_CONTROL_CACHE_SECONDS * 1000));
}

const getCachedPublicSettingsRow = unstable_cache(
  async (bucket: number): Promise<Record<string, unknown>> => {
    void bucket;
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("store_settings_public")
      .select(PUBLIC_STORE_SETTINGS_COLUMNS)
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(`[store-control] public settings query failed: ${error.message}`);
    if (!data) throw new Error("[store-control] public settings row missing");
    return data as Record<string, unknown>;
  },
  publicCacheKeyParts("store-control-settings"),
  { revalidate: STORE_CONTROL_CACHE_SECONDS, tags: [PUBLIC_CACHE_TAGS.storeSettings] }
);

/** Raw rows only: active date windows are evaluated per request by the resolver. */
const getCachedBannerRows = unstable_cache(
  async (settingsUpdatedAt: string, bucket: number): Promise<StoreBannerRow[]> => {
    void settingsUpdatedAt;
    void bucket;
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("store_banners")
      .select(PUBLIC_STORE_BANNER_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`[store-control] public banners query failed: ${error.message}`);
    return (data ?? []) as StoreBannerRow[];
  },
  publicCacheKeyParts("store-control-banners"),
  { revalidate: STORE_CONTROL_CACHE_SECONDS, tags: [PUBLIC_CACHE_TAGS.storeBanners] }
);

function toPublicSettings(row: Record<string, unknown>): StoreSettingsRow {
  return { ...mapSettingsRow(row), private_access_password_hash: null, private_access_ips: [] };
}

/**
 * Store control for storefront rendering (layout and closed pages). Settings and
 * banners come from the public data cache; the waitlist count is never cached.
 * Falls back to the uncached authoritative path when the cache cannot be read,
 * and when the cached row has a due scheduled transition (so a stale row never
 * decides the displayed status and the transition is persisted from a fresh read).
 * Checkout enforcement must keep using `assertCheckoutAllowed`, not this.
 */
export async function getStorefrontStoreControl(
  options: { includeWaitlistCount?: (control: EffectiveStoreControl) => boolean } = {}
): Promise<EffectiveStoreControl> {
  let settings: StoreSettingsRow;
  let banners: StoreBannerRow[];
  let waitlistCount: number;
  try {
    const bucket = storeControlCacheBucket();
    settings = toPublicSettings(await getCachedPublicSettingsRow(bucket));
    if (applyScheduledTransitions(settings).changed) {
      return getEffectiveStoreControl(options);
    }
    const needsWaitlistCount = options.includeWaitlistCount
      ? options.includeWaitlistCount(resolveEffectiveStoreControl(settings))
      : true;
    [banners, waitlistCount] = await Promise.all([
      getCachedBannerRows(settings.updated_at, bucket),
      needsWaitlistCount ? getWaitlistCount() : Promise.resolve(0),
    ]);
  } catch {
    return getEffectiveStoreControl(options);
  }
  return resolveEffectiveStoreControl(settings, banners, { waitlistCount });
}
