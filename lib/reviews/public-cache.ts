import { unstable_cache } from "next/cache";
import {
  FEATURE_FLAGS_CACHE_SECONDS,
  PUBLIC_CACHE_TAGS,
  PUBLIC_CATALOGUE_REVALIDATE_SECONDS,
  publicCacheKeyParts,
  publicCacheWindow,
} from "@/lib/cache/public-catalogue";
import { mergeFeatureFlags } from "@/lib/feature-flags";
import { isReviewsFeatureEnabled } from "@/lib/reviews/feature";
import { getPublishedReviewAggregates, listPublishedReviews } from "@/lib/reviews/queries";
import type { ReviewAggregates, ReviewPublic } from "@/lib/reviews/types";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import type { FeatureFlags } from "@/lib/types";

/**
 * Product-page display only. Review submission, eligibility, the reviews API and
 * admin pages must keep using the uncached `isReviewsFeatureEnabled`.
 */

const getCachedStorefrontReviewsEnabled = unstable_cache(
  async (window: number): Promise<boolean> => {
    void window;
    const { data, error } = await createPublicSupabaseClient()
      .from("site_settings")
      .select("feature_flags")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(`[reviews] feature flags query failed: ${error.message}`);
    if (!data) throw new Error("[reviews] site_settings row missing");
    const raw =
      data.feature_flags && typeof data.feature_flags === "object" && !Array.isArray(data.feature_flags)
        ? (data.feature_flags as Partial<FeatureFlags>)
        : {};
    return Boolean(mergeFeatureFlags(raw).reviews);
  },
  publicCacheKeyParts("storefront-reviews-enabled"),
  { revalidate: FEATURE_FLAGS_CACHE_SECONDS, tags: [PUBLIC_CACHE_TAGS.featureFlags] }
);

/** Whether the product page shows reviews; falls back to the uncached read when the cache cannot be filled. */
export async function getStorefrontReviewsEnabled(): Promise<boolean> {
  try {
    return await getCachedStorefrontReviewsEnabled(publicCacheWindow(FEATURE_FLAGS_CACHE_SECONDS));
  } catch {
    return isReviewsFeatureEnabled();
  }
}

export type InitialProductReviews = {
  aggregates: ReviewAggregates;
  listed: { reviews: ReviewPublic[]; total: number; page: number; pageSize: number };
};

const INITIAL_REVIEWS_QUERY = { page: 1, pageSize: 8, sort: "newest" } as const;

/** Aggregate and first page share one entry so the rating summary and listed reviews always agree. */
const getCachedInitialProductReviews = unstable_cache(
  async (productId: string, window: number): Promise<InitialProductReviews> => {
    void window;
    const [aggregates, listed] = await Promise.all([
      getPublishedReviewAggregates(productId, { strict: true }),
      listPublishedReviews({ productId, ...INITIAL_REVIEWS_QUERY }, { strict: true }),
    ]);
    return { aggregates, listed };
  },
  publicCacheKeyParts("product-reviews-initial"),
  { revalidate: PUBLIC_CATALOGUE_REVALIDATE_SECONDS, tags: [PUBLIC_CACHE_TAGS.reviews] }
);

/**
 * Published reviews shown when a product page first loads. Only call this for a
 * product that exists, so arbitrary ids never create cache entries.
 */
export async function getInitialProductReviews(productId: string): Promise<InitialProductReviews> {
  try {
    return await getCachedInitialProductReviews(productId, publicCacheWindow(PUBLIC_CATALOGUE_REVALIDATE_SECONDS));
  } catch {
    const [aggregates, listed] = await Promise.all([
      getPublishedReviewAggregates(productId),
      listPublishedReviews({ productId, ...INITIAL_REVIEWS_QUERY }),
    ]);
    return { aggregates, listed };
  }
}
