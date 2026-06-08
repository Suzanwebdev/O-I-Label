import { createServiceRoleClient } from "@/lib/supabase/server";

import {
  isStorefrontClosedPreset,
  parseStorefrontClosedCopy,
  type StorefrontClosedCopy,
  type StorefrontClosedPreset,
} from "@/lib/storefront-closed";

export type SuperadminSiteSettingsView = {
  store_name: string;
  maintenance_mode: boolean;
  storefront_closed_preset: StorefrontClosedPreset;
  storefront_closed_copy: StorefrontClosedCopy;
  feature_flags: Record<string, unknown>;
  payment_moolre_enabled: boolean;
  payment_paystack_enabled: boolean;
  payment_flutterwave_enabled: boolean;
  tax_enabled: boolean;
  rate_limit_per_min: number | null;
};

const SELECT =
  "store_name, maintenance_mode, storefront_closed_preset, storefront_closed_copy, feature_flags, payment_moolre_enabled, payment_paystack_enabled, payment_flutterwave_enabled, tax_enabled, rate_limit_per_min";

export async function getSiteSettingsForSuperadmin(): Promise<SuperadminSiteSettingsView | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select(SELECT)
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...data,
    storefront_closed_preset: isStorefrontClosedPreset(data.storefront_closed_preset)
      ? data.storefront_closed_preset
      : "maintenance",
    storefront_closed_copy: parseStorefrontClosedCopy(data.storefront_closed_copy),
    feature_flags:
      data.feature_flags && typeof data.feature_flags === "object" && !Array.isArray(data.feature_flags)
        ? (data.feature_flags as Record<string, unknown>)
        : {},
  };
}
