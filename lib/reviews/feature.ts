import { createServiceRoleClient } from "@/lib/supabase/server";
import { defaultFeatureFlags, mergeFeatureFlags } from "@/lib/feature-flags";
import type { FeatureFlags } from "@/lib/types";

/** Authoritative storefront switch for customer reviews (PDP + homepage). */
export async function isReviewsFeatureEnabled(): Promise<boolean> {
  const flags = await getMergedFeatureFlags();
  return Boolean(flags.reviews);
}

export async function getMergedFeatureFlags(): Promise<FeatureFlags> {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("site_settings")
    .select("feature_flags")
    .eq("id", 1)
    .maybeSingle();

  const raw =
    data?.feature_flags && typeof data.feature_flags === "object" && !Array.isArray(data.feature_flags)
      ? (data.feature_flags as Partial<FeatureFlags>)
      : {};

  return mergeFeatureFlags(raw);
}

export async function setReviewsFeatureEnabled(enabled: boolean): Promise<FeatureFlags> {
  const service = createServiceRoleClient();
  const current = await getMergedFeatureFlags();
  const next = { ...current, reviews: enabled };

  const { data, error } = await service
    .from("site_settings")
    .update({ feature_flags: next, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("feature_flags")
    .single();

  if (error) throw new Error(error.message);

  const raw =
    data?.feature_flags && typeof data.feature_flags === "object" && !Array.isArray(data.feature_flags)
      ? (data.feature_flags as Partial<FeatureFlags>)
      : next;

  return mergeFeatureFlags(raw);
}

export { defaultFeatureFlags };
