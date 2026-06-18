export const SITE_NAME = "O & I Label";
export const SITE_LOCALE = "en_GH";
export const SITE_CURRENCY = "GHS";

/** Core fashion keywords — used naturally in metadata, not stuffed. */
export const DEFAULT_KEYWORDS = [
  "O & I Label",
  "women's fashion",
  "premium women's fashion",
  "luxury dresses",
  "bodycon dresses",
  "two-piece sets",
  "women's clothing",
  "online fashion store",
  "Ghana fashion",
  "feminine fashion",
  "designer dresses",
  "new arrivals",
] as const;

export function getSiteUrl(): string {
  const base =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}

export function toAbsoluteImageUrl(src: string): string {
  if (!src || src.startsWith("http://") || src.startsWith("https://")) return src;
  return absoluteUrl(src.startsWith("/") ? src : `/${src}`);
}

/** Bust social preview caches when CMS content changes without altering the image path. */
export function withOgCacheBuster(src: string, version: string | null | undefined): string {
  if (!version?.trim()) return src;
  const token = encodeURIComponent(version.trim());
  return src.includes("?") ? `${src}&ogv=${token}` : `${src}?ogv=${token}`;
}

export const DEFAULT_OG_IMAGE = "/home/hero.png";
