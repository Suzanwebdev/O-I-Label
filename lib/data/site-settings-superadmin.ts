import { createServiceRoleClient } from "@/lib/supabase/server";

export type SuperadminSiteSettingsView = {
  store_name: string;
  maintenance_mode: boolean;
  feature_flags: Record<string, unknown>;
  payment_moolre_enabled: boolean;
  payment_paystack_enabled: boolean;
  payment_flutterwave_enabled: boolean;
  tax_enabled: boolean;
  rate_limit_per_min: number | null;
};

const SELECT =
  "store_name, maintenance_mode, feature_flags, payment_moolre_enabled, payment_paystack_enabled, payment_flutterwave_enabled, tax_enabled, rate_limit_per_min";

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
    feature_flags:
      data.feature_flags && typeof data.feature_flags === "object" && !Array.isArray(data.feature_flags)
        ? (data.feature_flags as Record<string, unknown>)
        : {},
  };
}
