export const STORE_STATUSES = [
  "live",
  "maintenance",
  "pre_launch",
  "presale",
  "soft_close",
  "holiday_break",
  "inventory_update",
  "private_access",
] as const;

export type StoreStatus = (typeof STORE_STATUSES)[number];

export type StoreSettingsRow = {
  id: number;
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
  private_access_password_hash: string | null;
  private_access_ips: string[] | null;
  scheduled_activate_at: string | null;
  scheduled_deactivate_at: string | null;
  scheduled_status: StoreStatus | null;
  scheduled_timezone: string;
  revert_status: StoreStatus;
  show_waitlist_count: boolean;
  maintenance_use_503: boolean;
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

export type StoreWaitlistRow = {
  id: string;
  first_name: string;
  email_normalized: string;
  email_raw: string;
  phone_e164: string | null;
  country_iso: string;
  source: string;
  product_slug: string | null;
  welcome_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StoreControlAnalytics = {
  waitlistTotal: number;
  waitlistLast30d: number;
  presaleSignupsLast30d: number;
  launchSignupsLast30d: number;
  ordersLast30d: number;
  revenueLast30d: number;
  paidOrdersLast30d: number;
  conversionRateLast30d: number;
  topTrafficSources: Array<{ source: string; count: number }>;
};

export type EffectiveStoreControl = {
  storeStatus: StoreStatus;
  browsingAllowed: boolean;
  checkoutAllowed: boolean;
  countdownEnabled: boolean;
  countdownTarget: string | null;
  maintenanceMessage: string;
  supportingMessage: string | null;
  presaleCtaLabel: string;
  reopeningDate: string | null;
  launchDate: string | null;
  presaleDate: string | null;
  presaleHeroImageUrl: string | null;
  maintenanceHeroImageUrl: string | null;
  launchHeroImageUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  bannerText: string | null;
  bannerEnabled: boolean;
  activeBanners: Array<{ id: string; text: string; href: string | null }>;
  closedPageSlug: string | null;
  requiresPrivateAccess: boolean;
  isLive: boolean;
  showWaitlistCount: boolean;
  waitlistCount: number;
  softCloseMode: boolean;
};

export type StoreControlPublic = EffectiveStoreControl;
