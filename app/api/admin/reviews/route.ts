import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { listAdminReviews, moderateReview } from "@/lib/reviews/admin";
import type { ReviewStatus } from "@/lib/reviews/types";

export async function GET(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "all") as ReviewStatus | "all";
  const result = await listAdminReviews({ status });
  return NextResponse.json({ ok: true, ...result });
}

export async function PATCH(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const reviewId = typeof b.reviewId === "string" ? b.reviewId : "";
  if (!reviewId) {
    return NextResponse.json({ error: "reviewId required" }, { status: 400 });
  }

  const status =
    typeof b.status === "string" &&
    ["pending", "published", "rejected", "hidden"].includes(b.status)
      ? (b.status as ReviewStatus)
      : undefined;
  const featured = typeof b.featured === "boolean" ? b.featured : undefined;
  const del = b.delete === true;

  const result = await moderateReview({ reviewId, status, featured, delete: del });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
