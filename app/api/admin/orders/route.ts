import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

const allowedStatuses = new Set([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export async function PATCH(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin || !authz.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = typeof (body as { orderId?: unknown })?.orderId === "string" ? (body as { orderId: string }).orderId : "";
  const status = typeof (body as { status?: unknown })?.status === "string" ? (body as { status: string }).status : "";
  const notifyCustomer =
    typeof (body as { notifyCustomer?: unknown })?.notifyCustomer === "boolean"
      ? (body as { notifyCustomer: boolean }).notifyCustomer
      : undefined;
  const trackingNumber =
    typeof (body as { trackingNumber?: unknown })?.trackingNumber === "string"
      ? (body as { trackingNumber: string }).trackingNumber.trim()
      : "";
  const carrier =
    typeof (body as { carrier?: unknown })?.carrier === "string" ? (body as { carrier: string }).carrier.trim() : "";

  if (!orderId || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "orderId and valid status are required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: before } = await service
    .from("orders")
    .select("status, notify_customer")
    .eq("id", orderId)
    .maybeSingle();
  const orderUpdate: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (notifyCustomer !== undefined) {
    orderUpdate.notify_customer = notifyCustomer;
  }

  const { error: orderError } = await service.from("orders").update(orderUpdate).eq("id", orderId);
  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (status === "shipped" || trackingNumber || carrier) {
    const shipmentPayload = {
      order_id: orderId,
      tracking_number: trackingNumber || null,
      carrier: carrier || null,
      status,
    };

    const { data: existing } = await service
      .from("shipments")
      .select("id")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1);
    const shipmentId = existing?.[0]?.id;

    if (shipmentId) {
      const { error: shipmentError } = await service
        .from("shipments")
        .update({
          tracking_number: shipmentPayload.tracking_number,
          carrier: shipmentPayload.carrier,
          status: shipmentPayload.status,
        })
        .eq("id", shipmentId);
      if (shipmentError) {
        return NextResponse.json({ error: shipmentError.message }, { status: 500 });
      }
    } else {
      const { error: shipmentError } = await service.from("shipments").insert(shipmentPayload);
      if (shipmentError) {
        return NextResponse.json({ error: shipmentError.message }, { status: 500 });
      }
    }
  }

  const notes: string[] = [];
  if (before?.status && before.status !== status) {
    notes.push(`Status changed from ${before.status} to ${status}`);
  } else {
    notes.push(`Status set to ${status}`);
  }
  if (notifyCustomer !== undefined && before?.notify_customer !== notifyCustomer) {
    notes.push(`Notify customer set to ${notifyCustomer ? "on" : "off"}`);
  }
  if (trackingNumber) notes.push(`Tracking number updated`);
  if (carrier) notes.push(`Carrier updated`);

  await service.from("order_events").insert({
    order_id: orderId,
    event_type: "order_update",
    actor_id: authz.user.id,
    message: notes.join(" • "),
    meta: { status, notifyCustomer, trackingNumber: Boolean(trackingNumber), carrier: Boolean(carrier) },
  });

  return NextResponse.json({ ok: true });
}
