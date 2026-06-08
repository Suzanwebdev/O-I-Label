import type { StoreStatus } from "@/lib/store-control/types";

export const STORE_ACCESS_COOKIE = "oi_store_access";
export const STORE_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const STORE_STATUS_LABELS: Record<StoreStatus, string> = {
  live: "Live",
  maintenance: "Maintenance",
  pre_launch: "Pre-launch",
  presale: "Presale",
  holiday_break: "Holiday break",
  inventory_update: "Inventory update",
  private_access: "Private access",
};

export const STORE_STATUS_DESCRIPTIONS: Record<StoreStatus, string> = {
  live: "Storefront open — customers can browse and purchase.",
  maintenance: "Full closure with a premium status page.",
  pre_launch: "Launch landing only — products hidden.",
  presale: "Browse collections; purchasing disabled.",
  holiday_break: "Elegant away message with optional return date.",
  inventory_update: "Brief closure while inventory is refreshed.",
  private_access: "VIP preview — password, whitelist, or admin only.",
};

export function recommendedFlagsForStatus(status: StoreStatus): {
  browsing_enabled: boolean;
  checkout_enabled: boolean;
} {
  switch (status) {
    case "live":
      return { browsing_enabled: true, checkout_enabled: true };
    case "presale":
      return { browsing_enabled: true, checkout_enabled: false };
    case "private_access":
      return { browsing_enabled: true, checkout_enabled: true };
    default:
      return { browsing_enabled: false, checkout_enabled: false };
  }
}

export function defaultMessageForStatus(status: StoreStatus): string {
  switch (status) {
    case "maintenance":
      return "We're refining the O & I Label experience.";
    case "pre_launch":
      return "Launching soon — the next chapter of O & I Label.";
    case "presale":
      return "Preview the collection before launch.";
    case "holiday_break":
      return "We're taking a brief pause and will return refreshed.";
    case "inventory_update":
      return "Our collection is currently being curated.";
    case "private_access":
      return "Private preview — enter your access details to continue.";
    default:
      return "Welcome to O & I Label.";
  }
}

export function closedPageSlugForStatus(status: StoreStatus): string | null {
  switch (status) {
    case "maintenance":
      return "maintenance";
    case "pre_launch":
      return "pre-launch";
    case "holiday_break":
      return "holiday";
    case "inventory_update":
      return "inventory";
    case "private_access":
      return "private-access";
    default:
      return null;
  }
}
