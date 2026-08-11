import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { listPublishedReviews, getPublishedReviewAggregates } from "@/lib/reviews/queries";
import { submitReview } from "@/lib/reviews/submit";
import { ensureCustomerRecord } from "@/lib/customers/ensure-customer";

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "reviews:list", 60);
  if (limited) return limited;

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim();
  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }

  const ratingRaw = url.searchParams.get("rating");
  const rating =
    ratingRaw && ["1", "2", "3", "4", "5"].includes(ratingRaw)
      ? (Number(ratingRaw) as 1 | 2 | 3 | 4 | 5)
      : undefined;
  const withPhotos = url.searchParams.get("withPhotos") === "1";
  const sortParam = url.searchParams.get("sort");
  const sort =
    sortParam === "highest" || sortParam === "lowest" || sortParam === "newest"
      ? sortParam
      : "newest";
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "8");

  const [list, aggregates] = await Promise.all([
    listPublishedReviews({
      productId,
      rating,
      withPhotos,
      sort,
      page,
      pageSize,
    }),
    getPublishedReviewAggregates(productId),
  ]);

  return NextResponse.json({
    ok: true,
    ...list,
    aggregates,
  });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "reviews:submit", 8);
  if (limited) return limited;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "Please sign in to leave a review." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const orderItemId = typeof b.orderItemId === "string" ? b.orderItemId.trim() : "";
  const productId = typeof b.productId === "string" ? b.productId.trim() : "";
  const rating = Number(b.rating);
  const title = typeof b.title === "string" ? b.title : null;
  const reviewBody = typeof b.body === "string" ? b.body : "";
  const displayName = typeof b.displayName === "string" ? b.displayName : null;
  const mediaRaw = Array.isArray(b.media) ? b.media : [];
  const media = mediaRaw
    .map((m) => {
      if (!m || typeof m !== "object") return null;
      const row = m as { storage_path?: unknown; public_url?: unknown };
      if (typeof row.storage_path !== "string" || typeof row.public_url !== "string") return null;
      if (!row.storage_path.startsWith(`${user.id}/`)) return null;
      return { storage_path: row.storage_path, public_url: row.public_url };
    })
    .filter(Boolean) as Array<{ storage_path: string; public_url: string }>;

  if (!orderItemId || !productId) {
    return NextResponse.json({ error: "Missing purchase details." }, { status: 400 });
  }

  const service = createServiceRoleClient();
  await ensureCustomerRecord(service, {
    userId: user.id,
    email: user.email,
    fullName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
  });

  const result = await submitReview({
    customerId: user.id,
    orderItemId,
    productId,
    rating,
    title,
    body: reviewBody,
    displayName,
    media,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  return NextResponse.json({ ok: true, reviewId: result.reviewId });
}
