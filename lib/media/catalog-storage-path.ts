/** Public catalog objects live in this bucket under `catalog/`. */
export const PRODUCT_IMAGES_BUCKET = "product-images";

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;

/** `catalog/{timestamp}-{random}-{filename}` — no extra segments or traversal. */
const CATALOG_OBJECT_PATH_RE = /^catalog\/[a-zA-Z0-9._-]+$/;

function hasUnsafePathChars(value: string): boolean {
  return (
    value.includes("..") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.includes("%2e") ||
    value.includes("%2E") ||
    value.includes("%2f") ||
    value.includes("%2F") ||
    value.includes("%5c") ||
    value.includes("%5C")
  );
}

export function isCatalogObjectPath(path: string): boolean {
  if (!path || hasUnsafePathChars(path) || path.includes("//")) return false;
  return CATALOG_OBJECT_PATH_RE.test(path);
}

/**
 * Extract a catalog object path from a public Storage URL or a raw `catalog/…` path.
 * Rejects other buckets, CMS/hero prefixes, traversal, and (when origin is given) other hosts.
 */
export function parseCatalogObjectPath(
  input: string,
  supabaseUrl?: string | null
): string | null {
  const trimmed = input.trim();
  if (!trimmed || hasUnsafePathChars(trimmed)) return null;

  if (!trimmed.includes("://") && !trimmed.startsWith("/")) {
    return isCatalogObjectPath(trimmed) ? trimmed : null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  if (supabaseUrl) {
    try {
      const expected = new URL(supabaseUrl).origin;
      if (url.origin !== expected) return null;
    } catch {
      return null;
    }
  }

  const markerAt = url.pathname.indexOf(PUBLIC_OBJECT_PREFIX);
  if (markerAt === -1) return null;

  let objectPath: string;
  try {
    objectPath = decodeURIComponent(url.pathname.slice(markerAt + PUBLIC_OBJECT_PREFIX.length));
  } catch {
    return null;
  }

  if (hasUnsafePathChars(objectPath)) return null;
  return isCatalogObjectPath(objectPath) ? objectPath : null;
}

export function catalogObjectPublicUrl(path: string, supabaseUrl: string): string | null {
  if (!isCatalogObjectPath(path)) return null;
  try {
    const origin = new URL(supabaseUrl).origin;
    return `${origin}${PUBLIC_OBJECT_PREFIX}${path}`;
  } catch {
    return null;
  }
}

export function productImageRowReferencesCatalogPath(
  storagePath: string,
  catalogPath: string,
  supabaseUrl?: string | null
): boolean {
  const stored = storagePath.trim();
  if (!stored || !isCatalogObjectPath(catalogPath)) return false;
  if (stored === catalogPath) return true;
  return parseCatalogObjectPath(stored, supabaseUrl) === catalogPath;
}
