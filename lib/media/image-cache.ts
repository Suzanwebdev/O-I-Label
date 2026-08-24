/**
 * Cache-Control for newly uploaded public Storage objects whose paths are unique
 * (timestamp + random). Supabase Storage prefixes this value with `max-age=`.
 *
 * Do not use for in-place overwrites. Existing objects keep their original metadata
 * until a separate migration.
 */
export const VERSIONED_PUBLIC_IMAGE_CACHE_MAX_AGE_SECONDS = 31_536_000;

/** `upload(..., { cacheControl })` value → `Cache-Control: max-age=31536000, immutable`. */
export const VERSIONED_PUBLIC_IMAGE_CACHE_CONTROL = `${VERSIONED_PUBLIC_IMAGE_CACHE_MAX_AGE_SECONDS}, immutable`;
