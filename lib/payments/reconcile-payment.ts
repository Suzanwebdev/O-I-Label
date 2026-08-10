import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchMoolrePaymentStatus } from "./providers/moolre";
import { markOrderPaidByReference } from "./mark-order-paid";

export type ReconcileResult =
  | { ok: true; paid: true; idempotent?: boolean }
  | { ok: true; paid: false; reason: string }
  | { ok: false; reason: string };

export type PendingReconcileSummary = {
  checked: number;
  markedPaid: number;
  stillPending: number;
  failed: number;
  results: Array<{
    orderId: string;
    reference: string;
    outcome: "paid" | "still_pending" | "failed" | "skipped";
    reason?: string;
  }>;
};

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

  // Moolre already confirmed this exact reference — skip local amount re-check.
  const marked = await markOrderPaidByReference(payment.reference, "moolre", "reconcile", {
    skipAmountCheck: true,
    orderId,
  });
  if (!marked.ok) {
    return { ok: false, reason: marked.reason };
  }

  return { ok: true, paid: true, idempotent: marked.idempotent };
}

/**
 * Walk unpaid Moolre payments and mark each paid order by its unique payment reference.
 * Safe for many simultaneous customers — never matches by amount alone.
 */
export async function reconcilePendingPayments(opts?: {
  limit?: number;
  /** Only check payments newer than this many hours (default 72). */
  maxAgeHours?: number;
}): Promise<PendingReconcileSummary> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const maxAgeHours = Math.min(Math.max(opts?.maxAgeHours ?? 72, 1), 24 * 14);
  const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  const supabase = createServiceRoleClient();
  const { data: rows, error } = await supabase
    .from("payments")
    .select("id, order_id, reference, status, provider, created_at")
    .eq("provider", "moolre")
    .in("status", ["pending", "processing"])
    .not("reference", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      checked: 0,
      markedPaid: 0,
      stillPending: 0,
      failed: 1,
      results: [{ orderId: "", reference: "", outcome: "failed", reason: error.message }],
    };
  }

  const summary: PendingReconcileSummary = {
    checked: 0,
    markedPaid: 0,
    stillPending: 0,
    failed: 0,
    results: [],
  };

  for (const row of rows ?? []) {
    const orderId = String(row.order_id ?? "");
    const reference = String(row.reference ?? "").trim();
    if (!orderId || !reference) {
      summary.failed += 1;
      summary.results.push({
        orderId,
        reference,
        outcome: "failed",
        reason: "missing_reference",
      });
      continue;
    }

    summary.checked += 1;
    const result = await reconcileOrderPayment(orderId);

    if (result.ok && result.paid) {
      summary.markedPaid += 1;
      summary.results.push({
        orderId,
        reference,
        outcome: "paid",
        reason: result.idempotent ? "already_paid" : "reconciled",
      });
    } else if (result.ok && !result.paid) {
      summary.stillPending += 1;
      summary.results.push({
        orderId,
        reference,
        outcome: "still_pending",
        reason: result.reason,
      });
    } else {
      summary.failed += 1;
      summary.results.push({
        orderId,
        reference,
        outcome: "failed",
        reason: !result.ok ? result.reason : "unknown",
      });
    }
  }

  return summary;
}
