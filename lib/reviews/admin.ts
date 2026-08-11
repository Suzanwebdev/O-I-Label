import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ReviewStatus } from "@/lib/reviews/types";

export type AdminReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  display_name: string | null;
  status: ReviewStatus;
  verified_purchase: boolean;
  featured: boolean;
  purchased_color: string | null;
  purchased_size: string | null;
  created_at: string;
  published_at: string | null;
  product_id: string;
  product_name: string | null;
  order_id: string | null;
  order_number: string | null;
  photo_count: number;
};

export async function listAdminReviews(opts: {
  status?: ReviewStatus | "all";
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminReviewRow[]; total: number }> {
  const service = createServiceRoleClient();
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const offset = Math.max(0, opts.offset ?? 0);

  let q = service
    .from("reviews")
    .select(
      `
      id,
      rating,
      title,
      body,
      display_name,
      status,
      verified_purchase,
      featured,
      purchased_color,
      purchased_size,
      created_at,
      published_at,
      product_id,
      order_id,
      products ( name ),
      orders ( order_number ),
      review_media ( id )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const { data, error, count } = await q;
  if (error) {
    console.error("[reviews] listAdminReviews:", error.message);
    return { rows: [], total: 0 };
  }

  const rows: AdminReviewRow[] = (data ?? []).map((row) => {
    const products = row.products;
    const productObj = Array.isArray(products) ? products[0] : products;
    const orders = row.orders;
    const orderObj = Array.isArray(orders) ? orders[0] : orders;
    const media = Array.isArray(row.review_media) ? row.review_media : [];
    return {
      id: String(row.id),
      rating: Number(row.rating),
      title: row.title ? String(row.title) : null,
      body: row.body ? String(row.body) : null,
      display_name: row.display_name ? String(row.display_name) : null,
      status: row.status as ReviewStatus,
      verified_purchase: Boolean(row.verified_purchase),
      featured: Boolean(row.featured),
      purchased_color: row.purchased_color ? String(row.purchased_color) : null,
      purchased_size: row.purchased_size ? String(row.purchased_size) : null,
      created_at: String(row.created_at),
      published_at: row.published_at ? String(row.published_at) : null,
      product_id: String(row.product_id),
      product_name:
        productObj && typeof productObj === "object" && "name" in productObj
          ? String((productObj as { name?: string }).name ?? "") || null
          : null,
      order_id: row.order_id ? String(row.order_id) : null,
      order_number:
        orderObj && typeof orderObj === "object" && "order_number" in orderObj
          ? String((orderObj as { order_number?: string }).order_number ?? "") || null
          : null,
      photo_count: media.length,
    };
  });

  return { rows, total: count ?? rows.length };
}

export async function moderateReview(opts: {
  reviewId: string;
  status?: ReviewStatus;
  featured?: boolean;
  delete?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceRoleClient();

  if (opts.delete) {
    const { error } = await service.from("reviews").delete().eq("id", opts.reviewId);
    if (error) return { ok: false, error: "Could not delete review." };
    return { ok: true };
  }

  const patch: Record<string, unknown> = {};
  if (opts.status) patch.status = opts.status;
  if (typeof opts.featured === "boolean") patch.featured = opts.featured;
  if (opts.status === "published") patch.published_at = new Date().toISOString();

  if (!Object.keys(patch).length) {
    return { ok: false, error: "Nothing to update." };
  }

  const { error } = await service.from("reviews").update(patch).eq("id", opts.reviewId);
  if (error) {
    console.error("[reviews] moderate:", error.message);
    return { ok: false, error: "Could not update review." };
  }
  return { ok: true };
}
