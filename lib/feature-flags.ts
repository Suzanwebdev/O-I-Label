import type { FeatureFlags } from "@/lib/types";

export const defaultFeatureFlags: FeatureFlags = {
  reviews: true,
  loyalty: false,
  referrals: false,
  bundles_bogo: false,
  abandoned_cart: false,
  store_credit: false,
  subscriptions: false,
  staff_chat: false,
  advanced_analytics: false,
  instagram_shop: false,
};

export function mergeFeatureFlags(
  partial?: Partial<FeatureFlags> | null
): FeatureFlags {
  return { ...defaultFeatureFlags, ...partial };
}
