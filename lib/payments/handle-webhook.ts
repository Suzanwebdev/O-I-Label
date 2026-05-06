import { createServiceRoleClient } from "@/lib/supabase/server";
import type { PaymentProviderId } from "./types";
import { parseWebhook, verifyWebhook } from "./index";
import { sendOrderConfirmationEmail } from "@/lib/email/resend";
import {
  buildOrderStatusSmsBody,
  normalizeSmsRecipient,
  trySendOrderSms,
} from "@/lib/sms/order-notifications";

export async function handleProviderWebhook(
  provider: PaymentProviderId,
  rawBody: string,
  signature: string | null,
  parsedJson: unknown
) {
  const supabase = createServiceRoleClient();

  const sigOk = verifyWebhook(provider, rawBody, signature);
  const parsed = parseWebhook(provider, parsedJson);

  await supabase.from("webhook_logs").insert({
    provider,
    event_type: "payment",
    payload: parsedJson as object,
    signature_ok: sigOk,
    processed: false,
    error: sigOk ? null : "Invalid signature",
  });

  if (!sigOk || !parsed.success || !parsed.reference) {
    return { ok: false, reason: "verify_or_parse" };
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("reference", parsed.reference)
    .maybeSingle();

  if (!payment?.order_id) {
    return { ok: false, reason: "payment_not_found" };
  }

  if (payment.status === "paid") {
    return { ok: true, idempotent: true };
  }

  const { error: payErr } = await supabase
    .from("payments")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  if (payErr) {
    await supabase.from("webhook_logs").insert({
      provider,
      event_type: "payment_error",
      payload: { error: String(payErr.message) },
      signature_ok: true,
      processed: false,
    });
    return { ok: false, reason: "payment_update" };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, email, phone, total_ghs, notify_customer")
    .eq("id", payment.order_id)
    .single();

  if (order) {
    await supabase
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    if (order.notify_customer && order.email) {
      await sendOrderConfirmationEmail({
        to: order.email,
        orderNumber: order.order_number,
        totalGhs: Number(order.total_ghs),
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
          ref: `order_${order.id}_paid_webhook`,
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
          meta: { channel: "sms", status: "paid" },
        });
      }
    }
  }

  await supabase.from("webhook_logs").insert({
    provider,
    event_type: "payment_processed",
    payload: { reference: parsed.reference, order_id: payment.order_id },
    signature_ok: true,
    processed: true,
  });

  return { ok: true };
}
