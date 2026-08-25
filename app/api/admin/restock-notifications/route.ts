import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { getRestockDemandSummaryForProduct } from "@/lib/restock-notifications/demand-store";

/**
 * Admin-only aggregate restock demand for a product.
 * Returns counts by preferred size/colour — never emails or raw subscription rows.
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
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const result = await getRestockDemandSummaryForProduct(productId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...result });
}
