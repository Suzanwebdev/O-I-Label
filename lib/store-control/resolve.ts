import {
  closedPageSlugForStatus,
  defaultMessageForStatus,
} from "@/lib/store-control/constants";
import type {
  EffectiveStoreControl,
  StoreBannerRow,
  StoreSettingsRow,
  StoreStatus,
} from "@/lib/store-control/types";

export function isStoreStatus(value: unknown): value is StoreStatus {
  return (
    value === "live" ||
    value === "maintenance" ||
    value === "pre_launch" ||
    value === "presale" ||
    value === "soft_close" ||
    value === "holiday_break" ||
    value === "inventory_update" ||
    value === "private_access"
  );
}

function parseIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function activeBannersNow(
  banners: StoreBannerRow[],
  now = Date.now()
): Array<{ id: string; text: string; href: string | null }> {
  return banners
    .filter((b) => {
      if (!b.enabled) return false;
      const start = b.starts_at ? Date.parse(b.starts_at) : null;
      const end = b.ends_at ? Date.parse(b.ends_at) : null;
      if (start != null && Number.isFinite(start) && now < start) return false;
      if (end != null && Number.isFinite(end) && now > end) return false;
      return true;
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((b) => ({ id: b.id, text: b.text, href: b.href }));
}

export function pickCountdownTarget(settings: StoreSettingsRow): string | null {
  if (!settings.countdown_enabled) return null;
  return (
    parseIso(settings.launch_date) ??
    parseIso(settings.presale_date) ??
    parseIso(settings.reopening_date)
  );
}

export function resolveEffectiveStoreControl(
  settings: StoreSettingsRow,
  banners: StoreBannerRow[] = [],
  opts?: { waitlistCount?: number }
): EffectiveStoreControl {
  const storeStatus = settings.store_status;
  const browsingAllowed = settings.browsing_enabled;
  const checkoutAllowed = settings.checkout_enabled;
  const maintenanceMessage =
    settings.maintenance_message?.trim() || defaultMessageForStatus(storeStatus);
  const closedPageSlug =
    !browsingAllowed && storeStatus !== "live"
      ? closedPageSlugForStatus(storeStatus)
      : storeStatus === "private_access" && browsingAllowed
        ? closedPageSlugForStatus("private_access")
        : null;

  const activeBanners = activeBannersNow(banners);
  const legacyBanner =
    settings.banner_enabled && settings.banner_text?.trim()
      ? settings.banner_text.trim()
      : null;

  return {
    storeStatus,
    browsingAllowed,
    checkoutAllowed,
    countdownEnabled: settings.countdown_enabled,
    countdownTarget: pickCountdownTarget(settings),
    maintenanceMessage,
    supportingMessage: settings.supporting_message?.trim() || null,
    presaleCtaLabel: settings.presale_cta_label?.trim() || "Join waitlist",
    reopeningDate: parseIso(settings.reopening_date),
    launchDate: parseIso(settings.launch_date),
    presaleDate: parseIso(settings.presale_date),
    presaleHeroImageUrl: settings.presale_hero_image_url?.trim() || null,
    maintenanceHeroImageUrl: settings.maintenance_hero_image_url?.trim() || null,
    launchHeroImageUrl: settings.launch_hero_image_url?.trim() || null,
    instagramUrl: settings.instagram_url?.trim() || null,
    whatsappUrl: settings.whatsapp_url?.trim() || null,
    bannerText: legacyBanner,
    bannerEnabled: settings.banner_enabled,
    activeBanners,
    closedPageSlug,
    requiresPrivateAccess: storeStatus === "private_access",
    isLive: storeStatus === "live" && browsingAllowed && checkoutAllowed,
    showWaitlistCount: settings.show_waitlist_count,
    waitlistCount: opts?.waitlistCount ?? 0,
    softCloseMode: storeStatus === "soft_close",
  };
}

export type SchedulePatch = Partial<
  Pick<
    StoreSettingsRow,
    | "store_status"
    | "scheduled_activate_at"
    | "scheduled_deactivate_at"
    | "scheduled_status"
    | "revert_status"
    | "browsing_enabled"
    | "checkout_enabled"
  >
>;

function recommendedFlagsPatch(status: StoreStatus) {
  switch (status) {
    case "live":
      return { browsing_enabled: true, checkout_enabled: true };
    case "presale":
    case "soft_close":
      return { browsing_enabled: true, checkout_enabled: false };
    case "private_access":
      return { browsing_enabled: true, checkout_enabled: true };
    default:
      return { browsing_enabled: false, checkout_enabled: false };
  }
}

/** Apply due scheduled transitions (mutates a copy). */
export function applyScheduledTransitions(
  settings: StoreSettingsRow,
  now = new Date()
): { settings: StoreSettingsRow; changed: boolean } {
  let next = { ...settings };
  let changed = false;
  const nowMs = now.getTime();

  if (next.scheduled_activate_at && next.scheduled_status) {
    const at = Date.parse(next.scheduled_activate_at);
    if (Number.isFinite(at) && nowMs >= at) {
      next = {
        ...next,
        store_status: next.scheduled_status,
        scheduled_activate_at: null,
        scheduled_status: null,
        ...recommendedFlagsPatch(next.scheduled_status),
        updated_at: now.toISOString(),
      };
      changed = true;
    }
  }

  if (next.scheduled_deactivate_at) {
    const at = Date.parse(next.scheduled_deactivate_at);
    if (Number.isFinite(at) && nowMs >= at) {
      next = {
        ...next,
        store_status: next.revert_status ?? "live",
        scheduled_deactivate_at: null,
        ...recommendedFlagsPatch(next.revert_status ?? "live"),
        updated_at: now.toISOString(),
      };
      changed = true;
    }
  }

  return { settings: next, changed };
}

export { recommendedFlagsPatch as recommendedFlagsForStatusPatch };
