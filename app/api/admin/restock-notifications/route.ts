import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  getRestockDemandOverview,
  getRestockDemandSummaryForProduct,
} from "@/lib/restock-notifications/demand-store";

/**
 * Admin-only aggregate restock demand.
 *
 * - GET ?productId=… → single-product summary
 * - GET (no productId) → overview of products with active waiting demand
 *
 * Never returns emails, tokens, or raw subscription rows.
 */
export async function GET(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const productId = new URL(request.url).searchParams.get("productId")?.trim() ?? "";

  if (productId) {
    const result = await getRestockDemandSummaryForProduct(productId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  }

  const overview = await getRestockDemandOverview();
  if ("error" in overview) {
    return NextResponse.json({ error: overview.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, products: overview });
}
