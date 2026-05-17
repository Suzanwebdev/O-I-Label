import type { MetadataRoute } from "next";
import { getStoreSitemapEntries } from "@/lib/data/sitemap";
import { getSiteUrl } from "@/lib/seo/site";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const entries = await getStoreSitemapEntries();

  return entries.map((entry) => ({
    url: entry.path === "" ? base : `${base}${entry.path}`,
    lastModified: entry.lastModified ?? new Date(),
    changeFrequency: entry.changeFrequency ?? "weekly",
    priority: entry.priority ?? 0.7,
  }));
}
