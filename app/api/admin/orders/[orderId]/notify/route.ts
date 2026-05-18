import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/email/resend";
import {
  buildOrderStatusSmsBody,
  normalizeSmsRecipient,
  trySendOrderSms,
} from "@/lib/sms/order-notifications";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

function describeEmailResult(result: Awaited<ReturnType<typeof sendOrderStatusEmail>>) {
  if ("sent" in result && result.sent) return `Order status email sent`;
  if ("skipped" in result && result.skipped) return `Email skipped: ${result.reason}`;
  if ("error" in result) return `Email failed: ${result.error}`;
  return "Email: unknown result";
}

export async function POST(_request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin || !authz.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const service = createServiceRoleClient();
  const { data: order, error } = await service
    .from("orders")
    .select("id, order_number, email, phone, status, notify_customer")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 404 });
  }
  if (!order.email) {
    return NextResponse.json({ error: "Order has no customer email" }, { status: 400 });
  }

  const { data: shipment } = await service
    .from("shipments")
    .select("tracking_number")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const emailResult = await sendOrderStatusEmail({
    to: order.email,
    orderNumber: order.order_number,
    status: order.status,
    trackingNumber: shipment?.tracking_number ?? null,
  });

  await service.from("order_events").insert({
    order_id: order.id,
    event_type: "notification_sent",
    actor_id: authz.user.id,
    message: `${describeEmailResult(emailResult)} (${order.email})`,
    meta: {
      channel: "email",
      status: order.status,
      result: emailResult,
    },
  });

  let smsResult: { sent?: boolean; skipped?: string; error?: string } = { skipped: "no_phone" };
  const phone = normalizeSmsRecipient(order.phone);

  // Manual admin send always attempts SMS when a valid phone exists.
  if (phone) {
    const message = buildOrderStatusSmsBody({
      orderNumber: order.order_number,
      status: order.status,
      trackingNumber: shipment?.tracking_number ?? null,
    });
    const sms = await trySendOrderSms({
      recipient: phone,
      message,
      ref: `order_${order.id}_notify_manual`,
    });
    if (sms.ok) {
      smsResult = sms.sent ? { sent: true } : { skipped: sms.reason };
    } else {
      smsResult = { error: sms.error };
    }
    const masked = phone.length > 4 ? `${phone.slice(0, -4)}****` : "****";
    await service.from("order_events").insert({
      order_id: order.id,
      event_type: "notification_sent",
      actor_id: authz.user.id,
      message: sms.ok
        ? sms.sent
          ? `Order status SMS sent to ${masked}`
          : `Order status SMS skipped: ${sms.reason}`
        : `Order status SMS failed: ${sms.error}`,
      meta: { channel: "sms", status: order.status, phone_masked: masked },
    });
  }

  const emailOk = "sent" in emailResult && emailResult.sent;
  const smsOk = Boolean(smsResult.sent);
  const anySent = emailOk || smsOk;

  return NextResponse.json({
    ok: anySent,
    email: emailResult,
    sms: smsResult,
    summary: [
      emailOk
        ? `Email sent to ${order.email}`
        : "skipped" in emailResult
          ? `Email not sent (${emailResult.reason})`
          : "error" in emailResult
            ? `Email failed: ${emailResult.error}`
            : "Email not sent",
      smsOk
        ? "SMS sent"
        : smsResult.error
          ? `SMS failed: ${smsResult.error}`
          : smsResult.skipped
            ? `SMS not sent (${smsResult.skipped})`
            : "SMS not sent",
    ].join(" · "),
  });
}
