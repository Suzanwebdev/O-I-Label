import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchMetaCapiPurchaseIfNeeded } from "@/lib/analytics/meta-capi-purchase";
import { deductStockForPaidOrder } from "@/lib/inventory/deduct-order-stock";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendOrderConfirmationEmail } from "@/lib/email/resend";
import { observeOperationalEvent } from "@/lib/errors/capture-event";
import {
  buildOrderStatusSmsBody,
  normalizeSmsRecipient,
  trySendOrderSms,
} from "@/lib/sms/order-notifications";
import type { PaymentProviderId } from "./types";

export type MarkOrderPaidResult =
  | { ok: true; orderId: string; idempotent?: boolean }
  | { ok: false; reason: string };

const EXTERNAL_REF_ORDER_RE = /^oi_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i;

/** Payment statuses that may still become paid. `paid` and `refunded` never move back. */
const CLAIMABLE_PAYMENT_STATUSES = ["pending", "processing", "failed"];

/**
 * The claiming request updates the order immediately after claiming the payment, so a
 * paid payment claimed this long ago whose order still has no paid_at had that update
 * fail; anything younger may still be in flight and is left alone.
 */
export const ORDER_REPAIR_GRACE_MS = 10 * 60_000;

export type OrderRepairOutcome = "not_needed" | "too_recent" | "not_repairable" | "repaired" | "lost" | "failed";

/**
 * Narrow recovery for a paid payment whose order update failed: marks the order paid
 * (only while paid_at is still null and it is pending, or paid by an admin) and, only
 * when that conditional update wins, sends the Meta Purchase the claiming request could
 * not. Never repeats stock deduction, email, SMS or payment events.
 */
export async function repairIncompletePaidOrder(
  supabase: SupabaseClient,
  orderId: string,
  source: "webhook" | "reconcile" | "admin"
): Promise<OrderRepairOutcome> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.paid_at) return "not_needed";

  const { data: payment } = await supabase
    .from("payments")
    .select("status, updated_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (payment?.status !== "paid") return "not_needed";
  const claimedAt = Date.parse(String(payment.updated_at ?? ""));
  if (!Number.isFinite(claimedAt) || Date.now() - claimedAt < ORDER_REPAIR_GRACE_MS) return "too_recent";
  // An admin has already moved the order on (processing, shipped, cancelled…): leave it to them.
  if (order.status !== "pending" && order.status !== "paid") return "not_repairable";

  const { data: repaired, error } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: String(payment.updated_at), updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("paid_at", null)
    .in("status", ["pending", "paid"])
    .select("id");

  if (error) {
    observeOperationalEvent({
      severity: "critical",
      category: "payment",
      surface: source === "admin" ? "admin" : source === "reconcile" ? "cron" : "webhook",
      code: "paid_order_repair_failed",
      message: "Paid order could not be repaired after an earlier failed status update",
      metadata: { source, error_code: error.code ?? null },
    });
    return "failed";
  }
  if (!repaired || repaired.length !== 1) return "lost";

  if (order.status === "pending") {
    const { error: historyError } = await supabase.from("order_status_events").insert({
      order_id: orderId,
      from_status: "pending",
      to_status: "paid",
      payment_status: "paid",
      actor_id: null,
      note: "Order marked paid after an earlier failed status update",
    });
    // The repair itself stands; only the audit row is missing, so record it and carry on.
    if (historyError) {
      observeOperationalEvent({
        severity: "error",
        category: "payment",
        surface: source === "admin" ? "admin" : source === "reconcile" ? "cron" : "webhook",
        code: "paid_order_repair_status_history_failed",
        message: "Paid order was repaired but its status-history entry could not be recorded",
        metadata: { source, error_code: historyError.code ?? null },
      });
    }
  }
  await dispatchMetaCapiPurchaseIfNeeded(supabase, orderId, { source }).catch(() => {});
  return "repaired";
}

/** Idempotently mark payment + order as paid and send customer notifications. */
export async function markOrderPaidByReference(
  reference: string,
  provider: PaymentProviderId,
  source: "webhook" | "reconcile" | "admin",
  opts?: { amountGhs?: number; skipAmountCheck?: boolean; orderId?: string }
): Promise<MarkOrderPaidResult> {
  const supabase = createServiceRoleClient();
  const ref = reference.trim();
  if (!ref) {
    return { ok: false, reason: "payment_not_found" };
  }

  let payment: {
    id: string;
    order_id: string;
    status: string;
    amount_ghs: number | string | null;
  } | null = null;

  const { data: byRef } = await supabase
    .from("payments")
    .select("id, order_id, status, amount_ghs")
    .eq("reference", ref)
    .maybeSingle();

  if (byRef?.order_id) {
    payment = byRef;
  }

  // Fallback: webhook/metadata order id, or oi_<orderUuid>_… externalref shape.
  if (!payment) {
    const fromMeta = opts?.orderId?.trim();
    const fromRef = EXTERNAL_REF_ORDER_RE.exec(ref)?.[1];
    const orderId = fromMeta || fromRef;
    if (orderId) {
      const { data: byOrder } = await supabase
        .from("payments")
        .select("id, order_id, status, amount_ghs")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byOrder?.order_id) payment = byOrder;
    }
  }

  if (!payment?.order_id) {
    return { ok: false, reason: "payment_not_found" };
  }

  // Already confirmed: side effects belong to the request that claimed it. The only
  // follow-up is the guarded repair for an order whose update failed after the claim.
  if (payment.status === "paid") {
    await repairIncompletePaidOrder(supabase, payment.order_id, source);
    return { ok: true, orderId: payment.order_id, idempotent: true };
  }

  if (payment.status === "refunded") {
    return { ok: false, reason: "payment_refunded" };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, email, phone, total_ghs, notify_customer, status, paid_at")
    .eq("id", payment.order_id)
    .single();

  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }

  if (!opts?.skipAmountCheck) {
    const expected = Number(order.total_ghs);
    const paidAmount = opts?.amountGhs ?? Number(payment.amount_ghs);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - expected) > 0.01) {
      return { ok: false, reason: "amount_mismatch" };
    }
  }

  const paidAt = new Date().toISOString();
  // Atomic claim: concurrent confirmations (webhook, success page, poll, admin) race
  // on this row; only the one whose update matches runs the side effects below.
  const { data: claimed, error: payErr } = await supabase
    .from("payments")
    .update({ status: "paid", updated_at: paidAt })
    .eq("id", payment.id)
    .in("status", CLAIMABLE_PAYMENT_STATUSES)
    .select("id");

  if (payErr) {
    return { ok: false, reason: "payment_update" };
  }

  if (!claimed || claimed.length !== 1) {
    const { data: current } = await supabase
      .from("payments")
      .select("status")
      .eq("id", payment.id)
      .maybeSingle();
    if (current?.status === "paid") {
      return { ok: true, orderId: payment.order_id, idempotent: true };
    }
    if (current?.status === "refunded") {
      return { ok: false, reason: "payment_refunded" };
    }
    return { ok: false, reason: "payment_not_claimed" };
  }

  const fromStatus = order.status ?? "pending";
  const { error: orderErr } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: order.paid_at ?? paidAt,
      updated_at: paidAt,
    })
    .eq("id", order.id);
  if (orderErr) {
    observeOperationalEvent({
      severity: "critical",
      category: "payment",
      surface: source === "admin" ? "admin" : source === "reconcile" ? "cron" : "webhook",
      code: "paid_order_status_update_failed",
      message: "Payment confirmed but the order could not be marked paid",
      metadata: { source, provider, error_code: orderErr.code ?? null },
    });
  }

  const sourceNote =
    source === "webhook"
      ? "Payment confirmed via webhook"
      : source === "reconcile"
        ? "Payment confirmed via Moolre status check"
        : "Payment confirmed manually by admin";

  // The status history must not claim a pending → paid move that did not persist.
  if (!orderErr) {
    await supabase.from("order_status_events").insert({
      order_id: order.id,
      from_status: fromStatus,
      to_status: "paid",
      payment_status: "paid",
      actor_id: null,
      note: sourceNote,
    });
  }

  await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "payment_received",
    actor_id: null,
    message: orderErr
      ? "Payment confirmed — order status update failed; mark the order paid manually"
      : "Payment confirmed — order marked as paid",
    meta: { reference: ref, provider, source, ...(orderErr ? { order_update_failed: true } : {}) },
  });

  const stockResult = await deductStockForPaidOrder(supabase, order.id, {
    orderNumber: order.order_number,
    source,
  });
  if (!stockResult.ok) {
    await supabase.from("order_events").insert({
      order_id: order.id,
      event_type: "inventory_error",
      actor_id: null,
      message: `Stock deduction failed: ${stockResult.reason}`,
      meta: { reference: ref, provider, source },
    });
    observeOperationalEvent({
      severity: "critical",
      category: "inventory",
      surface: source === "admin" ? "admin" : source === "reconcile" ? "cron" : "webhook",
      code: `paid_order_${stockResult.reason}`,
      message: `Paid-order inventory deduction failed: ${stockResult.reason}`,
      metadata: { reason: stockResult.reason, source, provider },
    });
  }

  if (order.notify_customer && order.email) {
    await sendOrderConfirmationEmail({
      to: order.email,
      orderNumber: order.order_number,
      totalGhs: Number(order.total_ghs),
      orderId: order.id,
    });
  }

  if (order.notify_customer) {
    const phone = normalizeSmsRecipient(order.phone);
    if (phone) {
      const msg = buildOrderStatusSmsBody({
        orderNumber: order.order_number,
        status: "paid",
        trackingNumber: null,
      });
      const smsResult = await trySendOrderSms({
        recipient: phone,
        message: msg,
        ref: `order_${order.id}_paid_${source}`,
      });
      const smsMessage = smsResult.ok
        ? smsResult.sent
          ? "Payment confirmation SMS sent"
          : `Payment SMS skipped: ${smsResult.reason}`
        : `Payment SMS failed: ${smsResult.error}`;
      await supabase.from("order_events").insert({
        order_id: order.id,
        event_type: "notification_sent",
        actor_id: null,
        message: smsMessage,
        meta: { channel: "sms", status: "paid", source },
      });
    }
  }

  await dispatchMetaCapiPurchaseIfNeeded(supabase, order.id, { source }).catch(() => {});

  // The payment is claimed and side effects ran, but the order row was not marked paid.
  if (orderErr) return { ok: false, reason: "order_update_failed" };
  return { ok: true, orderId: order.id };
}
