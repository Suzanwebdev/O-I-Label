import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  recordOrderStatusEvent,
  syncPaymentForFulfillment,
  validateFulfillmentChange,
} from "@/lib/admin/order-status";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AdminOrderRow } from "@/lib/data/admin";

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

  const orderIds = Array.isArray((body as { orderIds?: unknown })?.orderIds)
    ? ((body as { orderIds: unknown[] }).orderIds as unknown[]).filter(
        (v): v is string => typeof v === "string" && v.length > 0
      )
    : [];
  const status =
    typeof (body as { status?: unknown })?.status === "string"
      ? (body as { status: string }).status
      : "";

  if (!orderIds.length || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "orderIds and valid status are required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const now = new Date().toISOString();
  const nextStatus = status as AdminOrderRow["status"];

  const { data: rows } = await service
    .from("orders")
    .select("id, status, paid_at")
    .in("id", orderIds);

  const { data: allPayments } = await service
    .from("payments")
    .select("order_id, status, updated_at, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  const paymentsByOrder = new Map<string, Array<{ status: string }>>();
  for (const p of allPayments ?? []) {
    const list = paymentsByOrder.get(p.order_id) ?? [];
    list.push(p);
    paymentsByOrder.set(p.order_id, list);
  }

  const blocked: string[] = [];
  const allowedIds: string[] = [];

  for (const row of rows ?? []) {
    const payments = paymentsByOrder.get(row.id) ?? [];
    const paymentPaid = payments.find((p) => p.status === "paid");
    const paymentStatus = (paymentPaid?.status ?? payments[0]?.status ?? null) as AdminOrderRow["payment_status"];

    const err = validateFulfillmentChange(
      {
        status: row.status as AdminOrderRow["status"],
        payment_status: paymentStatus,
        paid_at: row.paid_at ?? null,
      },
      nextStatus
    );
    if (err) {
      blocked.push(row.id);
    } else {
      allowedIds.push(row.id);
    }
  }

  if (!allowedIds.length) {
    return NextResponse.json(
      { error: "No orders could be updated with this status. Paid orders cannot go back to pending." },
      { status: 400 }
    );
  }

  const { error } = await service.from("orders").update({ status, updated_at: now }).in("id", allowedIds);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const id of allowedIds) {
    await syncPaymentForFulfillment(service, id, nextStatus);
    const row = rows?.find((r) => r.id === id);
    const payments = paymentsByOrder.get(id) ?? [];
    const paymentPaid = payments.find((p) => p.status === "paid");
    const paymentStatus = (paymentPaid?.status ?? payments[0]?.status ?? null) as AdminOrderRow["payment_status"];
    const effectivePaymentStatus = nextStatus === "refunded" ? "refunded" : paymentStatus;

    if (row && row.status !== status) {
      await recordOrderStatusEvent(service, {
        orderId: id,
        fromStatus: row.status as AdminOrderRow["status"],
        toStatus: nextStatus,
        paymentStatus: effectivePaymentStatus,
        actorId: authz.user.id,
        note: "Bulk fulfillment status change",
      });
    }
  }

  await service.from("order_events").insert(
    allowedIds.map((id) => ({
      order_id: id,
      event_type: "bulk_status_change",
      actor_id: authz.user?.id ?? null,
      message: `Fulfillment status changed to ${status} via bulk action`,
      meta: { status },
    }))
  );

  return NextResponse.json({
    ok: true,
    updated: allowedIds.length,
    skipped: blocked.length,
  });
}
