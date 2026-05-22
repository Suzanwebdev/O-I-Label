import { deductStockForPaidOrder } from "@/lib/inventory/deduct-order-stock";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendOrderConfirmationEmail } from "@/lib/email/resend";
import {
  buildOrderStatusSmsBody,
  normalizeSmsRecipient,
  trySendOrderSms,
} from "@/lib/sms/order-notifications";
import type { PaymentProviderId } from "./types";

export type MarkOrderPaidResult =
  | { ok: true; orderId: string; idempotent?: boolean }
  | { ok: false; reason: string };

/** Idempotently mark payment + order as paid and send customer notifications. */
export async function markOrderPaidByReference(
  reference: string,
  provider: PaymentProviderId,
  source: "webhook" | "reconcile" | "admin"
): Promise<MarkOrderPaidResult> {
  const supabase = createServiceRoleClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment?.order_id) {
    return { ok: false, reason: "payment_not_found" };
  }

  if (payment.status === "paid") {
    return { ok: true, orderId: payment.order_id, idempotent: true };
  }

  const paidAt = new Date().toISOString();
  const { error: payErr } = await supabase
    .from("payments")
    .update({ status: "paid", updated_at: paidAt })
    .eq("id", payment.id);

  if (payErr) {
    return { ok: false, reason: "payment_update" };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, email, phone, total_ghs, notify_customer, status, paid_at")
    .eq("id", payment.order_id)
    .single();

  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }

  const fromStatus = order.status ?? "pending";
  await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: order.paid_at ?? paidAt,
      updated_at: paidAt,
    })
    .eq("id", order.id);

  const sourceNote =
    source === "webhook"
      ? "Payment confirmed via webhook"
      : source === "reconcile"
        ? "Payment confirmed via Moolre status check"
        : "Payment confirmed manually by admin";

  await supabase.from("order_status_events").insert({
    order_id: order.id,
    from_status: fromStatus,
    to_status: "paid",
    payment_status: "paid",
    actor_id: null,
    note: sourceNote,
  });

  await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "payment_received",
    actor_id: null,
    message: "Payment confirmed — order marked as paid",
    meta: { reference, provider, source },
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
      meta: { reference, provider, source },
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

  return { ok: true, orderId: order.id };
}
