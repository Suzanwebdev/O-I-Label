import { createServiceRoleClient } from "@/lib/supabase/server";
import { assertEligibleOrderItem } from "@/lib/reviews/eligibility";
import {
  REVIEW_MAX_BODY,
  REVIEW_MAX_TITLE,
  sanitizeDisplayName,
} from "@/lib/reviews/types";

export type SubmitReviewInput = {
  customerId: string;
  orderItemId: string;
  productId: string;
  rating: number;
  title?: string | null;
  body: string;
  displayName?: string | null;
  media?: Array<{ storage_path: string; public_url: string }>;
};

export async function submitReview(input: SubmitReviewInput): Promise<
  | { ok: true; reviewId: string }
  | { ok: false; error: string; status?: number }
> {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Choose a rating from 1 to 5 stars.", status: 400 };
  }

  const body = (input.body ?? "").trim();
  if (body.length < 10) {
    return { ok: false, error: "Please write a short review (at least 10 characters).", status: 400 };
  }
  if (body.length > REVIEW_MAX_BODY) {
    return { ok: false, error: "Review is too long.", status: 400 };
  }

  const title = (input.title ?? "").trim().slice(0, REVIEW_MAX_TITLE) || null;

  const eligible = await assertEligibleOrderItem({
    customerId: input.customerId,
    orderItemId: input.orderItemId,
    productId: input.productId,
  });
  if (!eligible.ok) {
    return { ok: false, error: eligible.error, status: 403 };
  }

  const item = eligible.item;
  const displayName = sanitizeDisplayName(input.displayName, "O & I Customer");
  const media = (input.media ?? []).slice(0, 5);

  const service = createServiceRoleClient();
  const { data: review, error } = await service
    .from("reviews")
    .insert({
      product_id: item.product_id,
      customer_id: input.customerId,
      order_id: item.order_id,
      order_item_id: item.order_item_id,
      purchased_variant_id: item.purchased_variant_id,
      purchased_color: item.purchased_color,
      purchased_size: item.purchased_size,
      rating,
      title,
      body,
      display_name: displayName,
      status: "pending",
      verified_purchase: true,
      featured: false,
      photos: media.map((m) => m.public_url),
    })
    .select("id")
    .single();

  if (error || !review) {
    if (error?.code === "23505") {
      return { ok: false, error: "You have already reviewed this purchase.", status: 409 };
    }
    console.error("[reviews] submit:", error?.message);
    return { ok: false, error: "Your review could not be submitted.", status: 500 };
  }

  if (media.length) {
    const rows = media.map((m, i) => ({
      review_id: review.id,
      storage_path: m.storage_path,
      public_url: m.public_url,
      sort_order: i,
    }));
    const { error: mediaError } = await service.from("review_media").insert(rows);
    if (mediaError) {
      console.error("[reviews] media insert:", mediaError.message);
    }
  }

  return { ok: true, reviewId: String(review.id) };
}
