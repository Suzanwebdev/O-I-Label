import { revalidateTag } from "next/cache";

/**
 * Safety-net refresh for public catalogue / CMS data changed outside the admin
 * API (Supabase dashboard, scripts, triggers). Admin writes expire tags at once.
 */
export const PUBLIC_CATALOGUE_REVALIDATE_SECONDS = 300;

/**
 * Store-control settings change store availability, so they get a much shorter
 * safety-net window than catalogue data (it also bounds the time-bucket key).
 */
export const STORE_CONTROL_CACHE_SECONDS = 60;

/** The reviews switch hides or shows customer content, so it also gets a short window. */
export const FEATURE_FLAGS_CACHE_SECONDS = 60;

export const PUBLIC_CACHE_TAGS = {
  products: "public-catalogue:products",
  categories: "public-catalogue:categories",
  homeContent: "public-home-content",
  storeSettings: "public-store-control:settings",
  storeBanners: "public-store-control:banners",
  reviews: "public-catalogue:reviews",
  collections: "public-catalogue:collections",
  featureFlags: "public-site-settings:feature-flags",
} as const;

export type PublicCacheTag = (typeof PUBLIC_CACHE_TAGS)[keyof typeof PUBLIC_CACHE_TAGS];

/** Cache keys are scoped to the Supabase project so previews on other databases never share entries. */
export function publicCacheKeyParts(name: string): string[] {
  return ["public-catalogue", "v1", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "no-supabase-url", name];
}

/**
 * Part of a cache key: entries are only reused within one window, so rows changed
 * outside the admin API (which cannot expire tags) are at most one window old —
 * unlike `revalidate` alone, which serves a stale entry once before refreshing.
 */
export function publicCacheWindow(seconds: number, now = Date.now()): number {
  return Math.floor(now / (seconds * 1000));
}

/** Immediate expiry (not stale-while-revalidate) so the next storefront request reads fresh rows. */
export function expirePublicCacheTags(tags: readonly PublicCacheTag[]): void {
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }
}

type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Expire public caches after an admin route runs. Skipped on 401/403 so
 * unauthenticated callers cannot force cache flushes; any other outcome expires,
 * because a failing admin write may still have partially changed catalogue rows.
 */
export function withPublicCacheExpiry(
  handler: RouteHandler,
  tags: readonly PublicCacheTag[],
  expire: (tags: readonly PublicCacheTag[]) => void = expirePublicCacheTags
): RouteHandler {
  return async (request) => {
    const response = await handler(request);
    if (response.status !== 401 && response.status !== 403) {
      expire(tags);
    }
    return response;
  };
}
