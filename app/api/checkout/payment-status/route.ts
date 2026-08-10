import { NextResponse } from "next/server";
import { verifyOrderAccessToken } from "@/lib/auth/signed-token";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { reconcileOrderPayment } from "@/lib/payments/reconcile-payment";
import { enforceRateLimit } from "@/lib/http/rate-limit";

export const runtime = "nodejs";

/**
 * Customer-facing poll while waiting for MoMo / webhook confirmation.
 * Requires the signed order access token from checkout.
 */
export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "checkout:payment-status", 30);
  if (limited) return limited;

  const url = new URL(request.url);
  const orderId = url.searchParams.get("order")?.trim() ?? "";
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!orderId || !token || !verifyOrderAccessToken(orderId, token)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reconciled = await reconcileOrderPayment(orderId);
  const service = createServiceRoleClient();
  const [{ data: payment }, { data: order }] = await Promise.all([
    service
      .from("payments")
      .select("status, reference")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from("orders").select("status, paid_at, order_number").eq("id", orderId).maybeSingle(),
  ]);

  const paymentStatus = typeof payment?.status === "string" ? payment.status : "pending";
  const paid =
    paymentStatus === "paid" ||
    Boolean(order?.paid_at) ||
    (reconciled.ok && reconciled.paid);

  return NextResponse.json({
    ok: true,
    paid,
    status: paid ? "paid" : paymentStatus === "failed" ? "failed" : "pending",
    orderNumber: order?.order_number ?? null,
    reference: payment?.reference ?? null,
    reconciled: reconciled.ok && reconciled.paid,
  });
}
