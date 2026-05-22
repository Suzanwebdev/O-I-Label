import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOrderStatusEmail } from "@/lib/email/resend";
import {
  buildOrderStatusSmsBody,
  normalizeSmsRecipient,
  trySendOrderSms,
} from "@/lib/sms/order-notifications";

export type OrderNotifyChannelResult = {
  sent: boolean;
  skipped?: string;
  error?: string;
};

export type OrderCustomerNotifyResult = {
  orderId: string;
  orderNumber: string;
  ok: boolean;
  skipped?: string;
  email: OrderNotifyChannelResult;
  sms: OrderNotifyChannelResult;
  summary: string;
};

function describeEmailResult(result: Awaited<ReturnType<typeof sendOrderStatusEmail>>): string {
  if ("sent" in result && result.sent) return "Order status email sent";
  if ("skipped" in result && result.skipped) return `Email skipped: ${result.reason}`;
  if ("error" in result) return `Email failed: ${result.error}`;
  return "Email: unknown result";
}

function emailChannel(result: Awaited<ReturnType<typeof sendOrderStatusEmail>>): OrderNotifyChannelResult {
  if ("sent" in result && result.sent) return { sent: true };
  if ("skipped" in result && result.skipped) return { sent: false, skipped: result.reason };
  if ("error" in result) return { sent: false, error: result.error };
  return { sent: false, skipped: "unknown" };
}

/**
 * Send personalized email + SMS for one order (current status + latest tracking).
 * Logs order_events when actorId is provided.
 */
export async function sendOrderCustomerUpdate(
  service: SupabaseClient,
  orderId: string,
  opts?: {
    actorId?: string | null;
    /** When true, skip if orders.notify_customer is false. Default true. */
    respectNotifyFlag?: boolean;
    /** Override status in message (e.g. right after bulk status change). */
    statusOverride?: string;
    eventSource?: "manual" | "bulk_notify" | "bulk_status";
  }
): Promise<OrderCustomerNotifyResult | { error: string }> {
  const { data: order, error } = await service
    .from("orders")
    .select("id, order_number, email, phone, status, notify_customer")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return { error: error?.message ?? "Order not found" };
  }

  if (opts?.respectNotifyFlag !== false && !order.notify_customer) {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      ok: false,
      skipped: "notify_disabled",
      email: { sent: false, skipped: "notify_disabled" },
      sms: { sent: false, skipped: "notify_disabled" },
      summary: "Customer notifications are off for this order",
    };
  }

  if (!order.email?.trim()) {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      ok: false,
      skipped: "no_email",
      email: { sent: false, skipped: "no_email" },
      sms: { sent: false, skipped: "no_phone" },
      summary: "No customer email on file",
    };
  }

  const status = opts?.statusOverride ?? order.status;

  const { data: shipment } = await service
    .from("shipments")
    .select("tracking_number")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const trackingNumber = shipment?.tracking_number ?? null;

  const emailResult = await sendOrderStatusEmail({
    to: order.email,
    orderNumber: order.order_number,
    status,
    trackingNumber,
  });

  const emailCh = emailChannel(emailResult);

  if (opts?.actorId) {
    await service.from("order_events").insert({
      order_id: order.id,
      event_type: "notification_sent",
      actor_id: opts.actorId,
      message: `${describeEmailResult(emailResult)} (${order.email})`,
      meta: {
        channel: "email",
        status,
        source: opts.eventSource ?? "manual",
        result: emailResult,
      },
    });
  }

  let smsCh: OrderNotifyChannelResult = { sent: false, skipped: "no_phone" };
  const phone = normalizeSmsRecipient(order.phone);

  if (phone) {
    const message = buildOrderStatusSmsBody({
      orderNumber: order.order_number,
      status,
      trackingNumber,
    });
    const sms = await trySendOrderSms({
      recipient: phone,
      message,
      ref: `order_${order.id}_notify_${opts?.eventSource ?? "manual"}`,
    });
    if (sms.ok) {
      smsCh = sms.sent ? { sent: true } : { sent: false, skipped: sms.reason };
    } else {
      smsCh = { sent: false, error: sms.error };
    }

    if (opts?.actorId) {
      const masked = phone.length > 4 ? `${phone.slice(0, -4)}****` : "****";
      await service.from("order_events").insert({
        order_id: order.id,
        event_type: "notification_sent",
        actor_id: opts.actorId,
        message: sms.ok
          ? sms.sent
            ? `Order status SMS sent to ${masked}`
            : `Order status SMS skipped: ${sms.reason}`
          : `Order status SMS failed: ${sms.error}`,
        meta: {
          channel: "sms",
          status,
          source: opts.eventSource ?? "manual",
          phone_masked: masked,
        },
      });
    }
  }

  const ok = emailCh.sent || smsCh.sent;
  const summary = [
    emailCh.sent
      ? `Email sent to ${order.email}`
      : emailCh.skipped
        ? `Email not sent (${emailCh.skipped})`
        : emailCh.error
          ? `Email failed: ${emailCh.error}`
          : "Email not sent",
    smsCh.sent
      ? "SMS sent"
      : smsCh.skipped
        ? `SMS not sent (${smsCh.skipped})`
        : smsCh.error
          ? `SMS failed: ${smsCh.error}`
          : "SMS not sent",
  ].join(" · ");

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    ok,
    email: emailCh,
    sms: smsCh,
    summary,
  };
}

export async function sendOrderCustomerUpdates(
  service: SupabaseClient,
  orderIds: string[],
  opts?: {
    actorId?: string | null;
    respectNotifyFlag?: boolean;
    statusOverrideByOrderId?: Record<string, string>;
    eventSource?: "bulk_notify" | "bulk_status";
  }
): Promise<{
  results: OrderCustomerNotifyResult[];
  errors: Array<{ orderId: string; error: string }>;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const results: OrderCustomerNotifyResult[] = [];
  const errors: Array<{ orderId: string; error: string }> = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const orderId of orderIds) {
    const out = await sendOrderCustomerUpdate(service, orderId, {
      actorId: opts?.actorId,
      respectNotifyFlag: opts?.respectNotifyFlag,
      statusOverride: opts?.statusOverrideByOrderId?.[orderId],
      eventSource: opts?.eventSource,
    });

    if ("error" in out) {
      errors.push({ orderId, error: out.error });
      failed += 1;
      continue;
    }

    results.push(out);
    if (out.skipped) {
      skipped += 1;
    } else if (out.ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { results, errors, sent, failed, skipped };
}
