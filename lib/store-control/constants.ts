import type { LucideIcon } from "lucide-react";
import {
  Eye,
  Lock,
  Package,
  Palmtree,
  ShoppingBag,
  Sparkles,
  Store,
  Timer,
} from "lucide-react";
import type { StoreStatus } from "@/lib/store-control/types";

export const STORE_ACCESS_COOKIE = "oi_store_access";
export const STORE_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const STORE_STATUS_LABELS: Record<StoreStatus, string> = {
  live: "Live",
  maintenance: "Maintenance",
  pre_launch: "Pre-launch",
  presale: "Presale",
  soft_close: "Soft close",
  holiday_break: "Holiday break",
  inventory_update: "Inventory update",
  private_access: "Private access",
};

export const STORE_STATUS_DESCRIPTIONS: Record<StoreStatus, string> = {
  live: "Storefront open — customers can browse and purchase.",
  maintenance: "Full closure with a premium status page.",
  pre_launch: "Launch landing only — products hidden.",
  presale: "Browse collections; purchasing disabled with VIP waitlist.",
  soft_close:
    "Browse freely — wishlist and search stay on; purchasing paused while we prepare the next edit.",
  holiday_break: "Elegant away message with optional return date.",
  inventory_update: "Brief closure while inventory is refreshed.",
  private_access: "VIP preview — password, whitelist, or admin only.",
};

export type StoreStatusVisual = {
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  ring: string;
  badge: string;
};

export const STORE_STATUS_VISUAL: Record<StoreStatus, StoreStatusVisual> = {
  live: {
    label: "Live",
    description: STORE_STATUS_DESCRIPTIONS.live,
    icon: Store,
    accent: "border-emerald-200 bg-emerald-50/80",
    ring: "ring-emerald-500/30",
    badge: "bg-emerald-100 text-emerald-900",
  },
  maintenance: {
    label: "Maintenance",
    description: STORE_STATUS_DESCRIPTIONS.maintenance,
    icon: Timer,
    accent: "border-red-200 bg-red-50/60",
    ring: "ring-red-500/30",
    badge: "bg-red-100 text-red-900",
  },
  pre_launch: {
    label: "Pre-launch",
    description: STORE_STATUS_DESCRIPTIONS.pre_launch,
    icon: Sparkles,
    accent: "border-sky-200 bg-sky-50/70",
    ring: "ring-sky-500/30",
    badge: "bg-sky-100 text-sky-900",
  },
  presale: {
    label: "Presale",
    description: STORE_STATUS_DESCRIPTIONS.presale,
    icon: ShoppingBag,
    accent: "border-amber-200 bg-amber-50/70",
    ring: "ring-amber-500/35",
    badge: "bg-amber-100 text-amber-950",
  },
  soft_close: {
    label: "Soft close",
    description: STORE_STATUS_DESCRIPTIONS.soft_close,
    icon: Eye,
    accent: "border-stone-300 bg-stone-50/80",
    ring: "ring-stone-400/30",
    badge: "bg-stone-200 text-stone-900",
  },
  holiday_break: {
    label: "Holiday break",
    description: STORE_STATUS_DESCRIPTIONS.holiday_break,
    icon: Palmtree,
    accent: "border-orange-200 bg-orange-50/60",
    ring: "ring-orange-400/30",
    badge: "bg-orange-100 text-orange-950",
  },
  inventory_update: {
    label: "Inventory update",
    description: STORE_STATUS_DESCRIPTIONS.inventory_update,
    icon: Package,
    accent: "border-violet-200 bg-violet-50/60",
    ring: "ring-violet-400/30",
    badge: "bg-violet-100 text-violet-950",
  },
  private_access: {
    label: "Private access",
    description: STORE_STATUS_DESCRIPTIONS.private_access,
    icon: Lock,
    accent: "border-purple-200 bg-purple-50/70",
    ring: "ring-purple-500/30",
    badge: "bg-purple-100 text-purple-950",
  },
};

export function recommendedFlagsForStatus(status: StoreStatus): {
  browsing_enabled: boolean;
  checkout_enabled: boolean;
} {
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

export function defaultMessageForStatus(status: StoreStatus): string {
  switch (status) {
    case "maintenance":
      return "We're refining the O & I Label experience.";
    case "pre_launch":
      return "Launching soon — the next chapter of O & I Label.";
    case "presale":
      return "Preview the collection before launch.";
    case "soft_close":
      return "Purchasing is temporarily unavailable while we prepare our next edit.";
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

export function defaultSupportingMessage(status: StoreStatus): string | null {
  switch (status) {
    case "presale":
      return "Be first to shop the edit. Join our private list for early access and launch-day priority.";
    case "pre_launch":
      return "An intimate first look at what comes next — reserved for those on the list.";
    case "soft_close":
      return "Explore the collection, save your favourites, and return when the boutique reopens.";
    default:
      return null;
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
    case "presale":
      return "presale";
    default:
      return null;
  }
}

export const WAITLIST_CAMPAIGN_TYPES = [
  "waitlist_welcome",
  "presale_opening",
  "launch_day",
  "store_reopening",
  "maintenance_complete",
  "custom",
] as const;

export type WaitlistCampaignType = (typeof WAITLIST_CAMPAIGN_TYPES)[number];

export const STORE_CAMPAIGN_SUBJECTS: Record<WaitlistCampaignType, string> = {
  waitlist_welcome: "Welcome to the O & I Label Private List",
  presale_opening: "Your Early Access Starts Now",
  launch_day: "The Collection Is Live",
  store_reopening: "We're Back",
  maintenance_complete: "The Boutique Is Open Again",
  custom: "From O & I Label",
};
