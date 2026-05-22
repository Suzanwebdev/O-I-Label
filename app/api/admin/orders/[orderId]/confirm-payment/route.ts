import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { markOrderPaidByReference } from "@/lib/payments/mark-order-paid";
import { reconcileOrderPayment } from "@/lib/payments/reconcile-payment";
import type { PaymentProviderId } from "@/lib/payments/types";

type RouteContext = { params: Promise<{ orderId: string }> };

/** Sync payment with Moolre or force-mark paid when webhook was missed. */
export async function POST(_request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const reconciled = await reconcileOrderPayment(orderId);
  if (reconciled.ok && reconciled.paid) {
    return NextResponse.json({ ok: true, source: "reconcile", idempotent: reconciled.idempotent });
  }

  const service = createServiceRoleClient();
  const { data: payment } = await service
    .from("payments")
    .select("reference, status, provider")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment?.reference) {
    return NextResponse.json({ error: "No payment record for this order" }, { status: 404 });
  }

  if (payment.status === "paid") {
    return NextResponse.json({ ok: true, source: "already_paid", idempotent: true });
  }

  const marked = await markOrderPaidByReference(
    payment.reference,
    (payment.provider as PaymentProviderId) ?? "moolre",
    "admin"
  );

  if (!marked.ok) {
    return NextResponse.json({ error: marked.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true, source: "admin" });
}
