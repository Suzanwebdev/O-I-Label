import { getSiteUrl } from "@/lib/seo/site";

/** Canonical public origin for auth emails — prefers env over the current browser host. */
export function getClientSiteOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return getSiteUrl();
}

export function buildAuthCallbackUrl(nextPath: string, origin?: string): string {
  const base = (origin ?? getClientSiteOrigin()).replace(/\/$/, "");
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}
