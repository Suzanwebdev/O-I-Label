import type { MetadataRoute } from "next";
import { NextResponse } from "next/server";
import { getStoreSitemapEntries, SitemapSourceError } from "@/lib/data/sitemap";
import { serializeSitemap } from "@/lib/seo/sitemap-xml";
import { getSiteUrl } from "@/lib/seo/site";

/**
 * A route handler (not `app/sitemap.ts`) so an unreadable source can answer 503.
 * Success uses the same XML layout and Cache-Control as Next's generated sitemap route.
 */
export const dynamic = "force-dynamic";

const SITEMAP_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const UNAVAILABLE_RETRY_AFTER_SECONDS = 300;

export async function GET(): Promise<Response> {
  let entries;
  try {
    entries = await getStoreSitemapEntries();
  } catch (error) {
    if (!(error instanceof SitemapSourceError)) throw error;
    return new NextResponse("Sitemap temporarily unavailable.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": String(UNAVAILABLE_RETRY_AFTER_SECONDS),
      },
    });
  }

  const base = getSiteUrl();
  const sitemap: MetadataRoute.Sitemap = entries.map((entry) => ({
    url: entry.path === "" ? base : `${base}${entry.path}`,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency ?? "weekly",
    priority: entry.priority ?? 0.7,
  }));

  return new NextResponse(serializeSitemap(sitemap), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": SITEMAP_CACHE_CONTROL,
    },
  });
}
