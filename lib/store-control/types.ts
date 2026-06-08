export const STORE_STATUSES = [
  "live",
  "maintenance",
  "pre_launch",
  "presale",
  "holiday_break",
  "inventory_update",
  "private_access",
] as const;

export type StoreStatus = (typeof STORE_STATUSES)[number];

export type StoreSettingsRow = {
  id: number;
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
  private_access_password_hash: string | null;
  private_access_ips: string[] | null;
  scheduled_activate_at: string | null;
  scheduled_deactivate_at: string | null;
  scheduled_status: StoreStatus | null;
  revert_status: StoreStatus;
  updated_at: string;
};

export type StoreBannerRow = {
  id: string;
  text: string;
  href: string | null;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StoreAccessWhitelistRow = {
  id: string;
  email: string;
  note: string | null;
  created_at: string;
};

export type EffectiveStoreControl = {
  storeStatus: StoreStatus;
  browsingAllowed: boolean;
  checkoutAllowed: boolean;
  countdownEnabled: boolean;
  countdownTarget: string | null;
  maintenanceMessage: string;
  presaleCtaLabel: string;
  reopeningDate: string | null;
  launchDate: string | null;
  presaleDate: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  bannerText: string | null;
  bannerEnabled: boolean;
  activeBanners: Array<{ id: string; text: string; href: string | null }>;
  closedPageSlug: string | null;
  requiresPrivateAccess: boolean;
  isLive: boolean;
};

export type StoreControlPublic = EffectiveStoreControl;
