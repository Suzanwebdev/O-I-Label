import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  roundRating,
  type ReviewAggregates,
  type ReviewMediaPublic,
  type ReviewPublic,
} from "@/lib/reviews/types";
import { sanitizeDisplayName } from "@/lib/reviews/types";

export type ReviewListQuery = {
  productId: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  withPhotos?: boolean;
  sort?: "newest" | "highest" | "lowest";
  page?: number;
  pageSize?: number;
};

export async function getPublishedReviewAggregates(
  productId: string
): Promise<ReviewAggregates> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("reviews")
    .select("rating")
    .eq("product_id", productId)
    .eq("status", "published");

  const distribution: ReviewAggregates["distribution"] = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  if (error || !data?.length) {
    return { average: null, count: 0, distribution };
  }

  let sum = 0;
  for (const row of data) {
    const r = Number(row.rating);
    if (r >= 1 && r <= 5) {
      distribution[r as 1 | 2 | 3 | 4 | 5] += 1;
      sum += r;
    }
  }
  const count = data.length;
  return {
    average: count ? roundRating(sum / count) : null,
    count,
    distribution,
  };
}

function mapMedia(rows: unknown): ReviewMediaPublic[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((m) => {
      const row = m as {
        id?: string;
        public_url?: string;
        sort_order?: number;
      };
      if (!row.id || !row.public_url) return null;
      return {
        id: String(row.id),
        public_url: String(row.public_url),
        sort_order: Number(row.sort_order ?? 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a!.sort_order ?? 0) - (b!.sort_order ?? 0)) as ReviewMediaPublic[];
}

export async function listPublishedReviews(
  query: ReviewListQuery
): Promise<{ reviews: ReviewPublic[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(20, Math.max(1, query.pageSize ?? 8));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const service = createServiceRoleClient();
  let q = service
    .from("reviews")
    .select(
      `
      id,
      rating,
      title,
      body,
      display_name,
      verified_purchase,
      purchased_color,
      purchased_size,
      created_at,
      published_at,
      review_media ( id, public_url, sort_order )
    `,
      { count: "exact" }
    )
    .eq("product_id", query.productId)
    .eq("status", "published");

  if (query.rating) q = q.eq("rating", query.rating);

  if (query.sort === "highest") q = q.order("rating", { ascending: false }).order("created_at", { ascending: false });
  else if (query.sort === "lowest") q = q.order("rating", { ascending: true }).order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: false });

  const { data, error, count } = await q.range(from, to);
  if (error) {
    console.error("[reviews] listPublishedReviews:", error.message);
    return { reviews: [], total: 0, page, pageSize };
  }

  let reviews: ReviewPublic[] = (data ?? []).map((row) => ({
    id: String(row.id),
    rating: Number(row.rating),
    title: row.title ? String(row.title) : null,
    body: row.body ? String(row.body) : null,
    display_name: sanitizeDisplayName(row.display_name, "O & I Clientele"),
    verified_purchase: Boolean(row.verified_purchase),
    purchased_color: row.purchased_color ? String(row.purchased_color) : null,
    purchased_size: row.purchased_size ? String(row.purchased_size) : null,
    created_at: String(row.created_at),
    published_at: row.published_at ? String(row.published_at) : null,
    media: mapMedia(row.review_media),
  }));

  if (query.withPhotos) {
    reviews = reviews.filter((r) => r.media.length > 0);
  }

  return { reviews, total: count ?? reviews.length, page, pageSize };
}

export async function listFeaturedPublishedReviews(limit = 6): Promise<
  Array<
    ReviewPublic & {
      product_name: string | null;
      product_slug: string | null;
    }
  >
> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("reviews")
    .select(
      `
      id,
      rating,
      title,
      body,
      display_name,
      verified_purchase,
      purchased_color,
      purchased_size,
      created_at,
      published_at,
      review_media ( id, public_url, sort_order ),
      products ( name, slug )
    `
    )
    .eq("status", "published")
    .eq("featured", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    // Fallback: recent published with photos or high rating
    const { data: fallback } = await service
      .from("reviews")
      .select(
        `
        id,
        rating,
        title,
        body,
        display_name,
        verified_purchase,
        purchased_color,
        purchased_size,
        created_at,
        published_at,
        review_media ( id, public_url, sort_order ),
        products ( name, slug )
      `
      )
      .eq("status", "published")
      .gte("rating", 4)
      .order("published_at", { ascending: false })
      .limit(limit);
    return mapFeatured(fallback ?? []);
  }

  return mapFeatured(data);
}

function mapFeatured(
  rows: Array<Record<string, unknown>>
): Array<
  ReviewPublic & { product_name: string | null; product_slug: string | null }
> {
  return rows.map((row) => {
    const products = row.products;
    const productObj = Array.isArray(products) ? products[0] : products;
    return {
      id: String(row.id),
      rating: Number(row.rating),
      title: row.title ? String(row.title) : null,
      body: row.body ? String(row.body) : null,
      display_name: sanitizeDisplayName(
        row.display_name as string | null,
        "O & I Clientele"
      ),
      verified_purchase: Boolean(row.verified_purchase),
      purchased_color: row.purchased_color ? String(row.purchased_color) : null,
      purchased_size: row.purchased_size ? String(row.purchased_size) : null,
      created_at: String(row.created_at),
      published_at: row.published_at ? String(row.published_at) : null,
      media: mapMedia(row.review_media),
      product_name:
        productObj && typeof productObj === "object" && "name" in productObj
          ? String((productObj as { name?: string }).name ?? "") || null
          : null,
      product_slug:
        productObj && typeof productObj === "object" && "slug" in productObj
          ? String((productObj as { slug?: string }).slug ?? "") || null
          : null,
    };
  });
}
