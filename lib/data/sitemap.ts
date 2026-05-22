import { listPublishedBlogPosts } from "@/lib/data/blog";
import { listCategoriesFromDb, listProducts } from "@/lib/data/catalog";

export type SitemapEntry = {
  path: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

export async function getStoreSitemapEntries(): Promise<SitemapEntry[]> {
  const [products, categories, blogPosts] = await Promise.all([
    listProducts(),
    listCategoriesFromDb(),
    listPublishedBlogPosts(),
  ]);

  const staticPages: SitemapEntry[] = [
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
    { path: "/track-order", priority: 0.5, changeFrequency: "monthly" },
    { path: "/policies/shipping", priority: 0.4, changeFrequency: "yearly" },
    { path: "/policies/returns", priority: 0.4, changeFrequency: "yearly" },
    { path: "/policies/privacy", priority: 0.4, changeFrequency: "yearly" },
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
