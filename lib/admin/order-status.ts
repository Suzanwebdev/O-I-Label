import type { AdminOrderRow } from "@/lib/data/admin";

export type OrderFulfillmentStatus = AdminOrderRow["status"];
export type OrderPaymentStatus = NonNullable<AdminOrderRow["payment_status"]>;

const fulfillmentStatuses: OrderFulfillmentStatus[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export function isOrderPaid(order: Pick<AdminOrderRow, "payment_status" | "paid_at">): boolean {
  return order.payment_status === "paid" || Boolean(order.paid_at);
}

/** Tab/filter matching: "paid" = confirmed payment; other tabs = fulfillment status. */
export function matchesOrderStatusFilter(
  order: Pick<AdminOrderRow, "payment_status" | "paid_at">,
  fulfillmentStatus: OrderFulfillmentStatus,
  filter: "all" | OrderFulfillmentStatus
): boolean {
  if (filter === "all") return true;
  if (filter === "paid") return isOrderPaid(order);
  return fulfillmentStatus === filter;
}

export function countOrdersForStatusFilter(
  orders: AdminOrderRow[],
  resolveStatus: (order: AdminOrderRow) => OrderFulfillmentStatus
): Record<OrderFulfillmentStatus, number> {
  const counts: Record<OrderFulfillmentStatus, number> = {
    pending: 0,
    paid: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
  };

  for (const order of orders) {
    const fulfillment = resolveStatus(order);
    if (isOrderPaid(order)) counts.paid += 1;
    if (fulfillment === "pending" && !isOrderPaid(order)) {
      counts.pending += 1;
      continue;
    }
    if (fulfillment === "paid" && isOrderPaid(order)) continue;
    counts[fulfillment] += 1;
  }

  return counts;
}

export function paymentTone(status: AdminOrderRow["payment_status"]) {
  if (status === "paid") return "bg-emerald-100 text-emerald-800";
  if (status === "refunded") return "bg-red-100 text-red-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  if (status === "processing") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

export function fulfillmentTone(status: OrderFulfillmentStatus) {
  if (status === "delivered") return "bg-emerald-100 text-emerald-800";
  if (status === "processing" || status === "shipped") return "bg-blue-100 text-blue-800";
  if (status === "cancelled" || status === "refunded") return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-violet-100 text-violet-800";
  return "bg-amber-100 text-amber-800";
}

export function paymentLabel(order: Pick<AdminOrderRow, "payment_status" | "paid_at">): string {
  if (order.payment_status === "refunded") return "REFUNDED";
  if (isOrderPaid(order)) return "PAID";
  if (order.payment_status === "failed") return "FAILED";
  if (order.payment_status === "processing") return "PAYING";
  return "UNPAID";
}

/** Fulfillment statuses an admin may set for this order. */
export function allowedFulfillmentStatuses(
  order: Pick<AdminOrderRow, "status" | "payment_status" | "paid_at">
): OrderFulfillmentStatus[] {
  if (order.payment_status === "refunded") {
    return ["refunded", "cancelled"];
  }

  if (isOrderPaid(order)) {
    return ["paid", "processing", "shipped", "delivered", "refunded", "cancelled"];
  }

  return ["pending", "cancelled"];
}

export function validateFulfillmentChange(
  order: Pick<AdminOrderRow, "status" | "payment_status" | "paid_at">,
  nextStatus: OrderFulfillmentStatus
): string | null {
  if (!fulfillmentStatuses.includes(nextStatus)) {
    return "Invalid status.";
  }

  if (isOrderPaid(order) && nextStatus === "pending") {
    return "Paid orders cannot be moved back to pending.";
  }

  if (!isOrderPaid(order) && nextStatus === "paid") {
    return "Use payment confirmation to mark an order as paid.";
  }

  if (!isOrderPaid(order) && ["processing", "shipped", "delivered", "refunded"].includes(nextStatus)) {
    return "Fulfillment steps require a confirmed payment first.";
  }

  if (!allowedFulfillmentStatuses(order).includes(nextStatus)) {
    return `Cannot set status to ${nextStatus} for this order.`;
  }

  return null;
}

export type RecordStatusEventInput = {
  orderId: string;
  fromStatus: OrderFulfillmentStatus | null;
  toStatus: OrderFulfillmentStatus;
  paymentStatus: OrderPaymentStatus | null;
  actorId: string | null;
  note?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseService = { from: (table: string) => any };

export async function recordOrderStatusEvent(supabase: SupabaseService, input: RecordStatusEventInput) {
  const { error } = await supabase.from("order_status_events").insert({
    order_id: input.orderId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    payment_status: input.paymentStatus,
    actor_id: input.actorId,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function syncPaymentForFulfillment(
  supabase: SupabaseService,
  orderId: string,
  fulfillmentStatus: OrderFulfillmentStatus
) {
  if (fulfillmentStatus !== "refunded") return;

  const { data: payments } = await supabase
    .from("payments")
    .select("id, status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(5);

  const paidIds = (payments ?? []).filter((p: { status: string }) => p.status === "paid").map((p: { id: string }) => p.id);
  if (!paidIds.length) return;

  const now = new Date().toISOString();
  for (const id of paidIds) {
    await supabase.from("payments").update({ status: "refunded", updated_at: now }).eq("id", id);
  }
}
