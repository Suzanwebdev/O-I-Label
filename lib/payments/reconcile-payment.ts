import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchMoolrePaymentStatus } from "./providers/moolre";
import { markOrderPaidByReference } from "./mark-order-paid";

export type ReconcileResult =
  | { ok: true; paid: true; idempotent?: boolean }
  | { ok: true; paid: false; reason: string }
  | { ok: false; reason: string };

/** If Moolre reports success but our DB is still pending, mark the order paid. */
export async function reconcileOrderPayment(orderId: string): Promise<ReconcileResult> {
  const supabase = createServiceRoleClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, reference, status, provider")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment?.reference) {
    return { ok: false, reason: "no_payment" };
  }

  if (payment.status === "paid") {
    return { ok: true, paid: true, idempotent: true };
  }

  if (payment.provider !== "moolre") {
    return { ok: true, paid: false, reason: "provider_not_moolre" };
  }

  let moolrePaid = false;
  try {
    moolrePaid = await fetchMoolrePaymentStatus(payment.reference);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "status_check_failed";
    return { ok: false, reason: msg };
  }

  if (!moolrePaid) {
    return { ok: true, paid: false, reason: "moolre_not_paid" };
  }

  const marked = await markOrderPaidByReference(payment.reference, "moolre", "reconcile");
  if (!marked.ok) {
    return { ok: false, reason: marked.reason };
  }

  return { ok: true, paid: true, idempotent: marked.idempotent };
}
