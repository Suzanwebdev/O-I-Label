import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { reconcileOrderPayment } from "@/lib/payments/reconcile-payment";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * Ask Moolre whether this order's payment reference was paid.
 * Never marks paid unless Moolre confirms success.
 */
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

  const reason = reconciled.ok ? reconciled.reason : reconciled.reason;
  const message =
    reason === "moolre_not_paid"
      ? "Moolre has not confirmed this payment yet. The order stays unpaid."
      : reason === "no_payment"
        ? "No payment record found for this order."
        : reason === "provider_not_moolre"
          ? "This payment is not a Moolre payment."
          : `Could not confirm with Moolre (${reason}). Order stays unpaid.`;

  return NextResponse.json(
    {
      ok: false,
      source: "reconcile",
      paid: false,
      reason,
      error: message,
    },
    { status: 409 }
  );
}
