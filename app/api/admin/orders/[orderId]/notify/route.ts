import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/email/resend";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin || !authz.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const service = createServiceRoleClient();
  const { data: order, error } = await service
    .from("orders")
    .select("id, order_number, email, status, notify_customer")
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
    message: emailResult.sent
      ? `Order status email sent to ${order.email}`
      : "Order status email skipped (missing email provider key)",
    meta: {
      status: order.status,
      notify_customer: order.notify_customer,
      skipped: Boolean((emailResult as { skipped?: boolean }).skipped),
    },
  });

  return NextResponse.json({ ok: true, ...emailResult });
}
