import { listPublishedBlogPostsForSitemap } from "@/lib/data/blog";
import { listCategoriesForSitemap, listProductsForSitemap } from "@/lib/data/catalog";

export type SitemapEntry = {
  path: string;
  /** Only set when a real modification date is known; never the generation time. */
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

/** A sitemap source could not be read, so the sitemap would be incomplete. */
export class SitemapSourceError extends Error {
  constructor(readonly sources: string[]) {
    super(`[sitemap] unavailable sources: ${sources.join(", ")}`);
    this.name = "SitemapSourceError";
  }
}

function failureMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export async function getStoreSitemapEntries(): Promise<SitemapEntry[]> {
  const [productsResult, categoriesResult, blogPostsResult] = await Promise.allSettled([
    listProductsForSitemap(),
    listCategoriesForSitemap(),
    listPublishedBlogPostsForSitemap(),
  ]);

  const failed: string[] = [];
  for (const [source, result] of [
    ["products", productsResult],
    ["categories", categoriesResult],
    ["blog posts", blogPostsResult],
  ] as const) {
    if (result.status === "rejected") {
      failed.push(source);
      console.error(`[sitemap] ${source} could not be read:`, failureMessage(result.reason));
    }
  }
  if (
    productsResult.status === "rejected" ||
    categoriesResult.status === "rejected" ||
    blogPostsResult.status === "rejected"
  ) {
    throw new SitemapSourceError(failed);
  }
  const products = productsResult.value;
  const categories = categoriesResult.value;
  const blogPosts = blogPostsResult.value;

  const staticPages: SitemapEntry[] = [
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
    { path: "/track-order", priority: 0.5, changeFrequency: "monthly" },
    { path: "/policies/shipping", priority: 0.4, changeFrequency: "yearly" },
    { path: "/policies/returns", priority: 0.4, changeFrequency: "yearly" },
    { path: "/policies/privacy", priority: 0.4, changeFrequency: "yearly" },
    { path: "/policies/cookies", priority: 0.4, changeFrequency: "yearly" },
    { path: "/policies/terms", priority: 0.4, changeFrequency: "yearly" },
  ];

  const productEntries: SitemapEntry[] = products
    .filter((p) => p.is_active && p.variants.length > 0)
    .map((p) => ({
      path: `/product/${p.slug}`,
      priority: 0.85,
      changeFrequency: "weekly" as const,
    }));

  const categoryEntries: SitemapEntry[] = categories.map((c) => ({
    path: `/shop/${c.slug}`,
    priority: 0.8,
    changeFrequency: "weekly" as const,
  }));

  const blogEntries: SitemapEntry[] = blogPosts.map((p) => ({
    path: `/blog/${p.slug}`,
    priority: 0.65,
    changeFrequency: "monthly" as const,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : undefined,
  }));

  return [...staticPages, ...categoryEntries, ...productEntries, ...blogEntries];
}
