/** Validate product image references stored in product_images.storage_path. */
export function isAllowedProductImagePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return false;

  if (trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:") return false;
      if (url.username || url.password) return false;
      return true;
    } catch {
      return false;
    }
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("data:") || trimmed.includes("://")) {
    return false;
  }

  return /^[a-zA-Z0-9_./-]+$/.test(trimmed);
}

export function normalizeProductImagePaths(paths: string[]): string[] {
  return paths
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(isAllowedProductImagePath)
    .slice(0, 20);
}
