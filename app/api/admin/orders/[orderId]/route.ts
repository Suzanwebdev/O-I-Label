import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await context.params;
  const service = createServiceRoleClient();

  const [{ data: order, error: orderError }, { data: items }, { data: payments }, { data: shipments }, { data: events }] =
    await Promise.all([
      service
        .from("orders")
        .select(
          "id, order_number, email, phone, status, subtotal_ghs, shipping_ghs, tax_ghs, discount_ghs, total_ghs, created_at, updated_at, notes, shipping_address, billing_address"
        )
        .eq("id", orderId)
        .maybeSingle(),
      service
        .from("order_items")
        .select("id, name, sku, unit_price_ghs, quantity")
        .eq("order_id", orderId),
      service
        .from("payments")
        .select("id, provider, status, amount_ghs, reference, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      service
        .from("shipments")
        .select("id, carrier, tracking_number, status, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      service
        .from("order_events")
        .select("id, event_type, message, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
    ]);

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      ...order,
      subtotal_ghs: Number(order.subtotal_ghs ?? 0),
      shipping_ghs: Number(order.shipping_ghs ?? 0),
      tax_ghs: Number(order.tax_ghs ?? 0),
      discount_ghs: Number(order.discount_ghs ?? 0),
      total_ghs: Number(order.total_ghs ?? 0),
    },
    items: (items ?? []).map((i) => ({
      ...i,
      unit_price_ghs: Number(i.unit_price_ghs ?? 0),
    })),
    payments: (payments ?? []).map((p) => ({
      ...p,
      amount_ghs: Number(p.amount_ghs ?? 0),
    })),
    shipments: shipments ?? [],
    events: events ?? [],
  });
}
