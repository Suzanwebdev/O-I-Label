import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
};

export type BlogPost = BlogPostSummary & {
  body: string;
};

function blogCoverUrl(coverPath: string | null): string | null {
  if (!coverPath) return null;
  if (coverPath.startsWith("http://") || coverPath.startsWith("https://")) return coverPath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const path = coverPath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/blog-covers/${path}`;
}

function mapRow(row: {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body?: string;
  cover_path: string | null;
  published_at: string | null;
}): BlogPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverUrl: blogCoverUrl(row.cover_path),
    publishedAt: row.published_at,
  };
}

export async function listPublishedBlogPosts(): Promise<BlogPostSummary[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_path, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false, nullsFirst: false });

    if (error || !data) return [];
    return data.map(mapRow);
  } catch {
    return [];
  }
}

export type SitemapBlogPost = { slug: string; publishedAt: string | null };

/**
 * Sitemap blog entries: published posts only (`blog_public_read` allows anonymous
 * reads of published rows), same order as the blog index. Uncached, so publishing
 * or unpublishing shows immediately. Strict: throws when posts cannot be read.
 */
export async function listPublishedBlogPostsForSitemap(): Promise<SitemapBlogPost[]> {
  const { data, error } = await createPublicSupabaseClient()
    .from("blog_posts")
    .select("slug, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`[blog] sitemap posts query failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    slug: String(row.slug),
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
  }));
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, body, cover_path, published_at")
      .eq("published", true)
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;
    return { ...mapRow(data), body: data.body };
  } catch {
    return null;
  }
}
