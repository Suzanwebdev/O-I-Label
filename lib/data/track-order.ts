import { createServiceRoleClient } from "@/lib/supabase/server";

export type PublicOrderTracking = {
  order_number: string;
  status: string;
  status_label: string;
  payment_status: string;
  payment_label: string;
  placed_at: string;
  total_ghs: number;
  items: Array<{ name: string; quantity: number; sku: string | null }>;
  tracking: Array<{
    carrier: string | null;
    tracking_number: string | null;
    status: string | null;
    updated_at: string;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Order received",
  paid: "Payment confirmed",
  processing: "Preparing your order",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  processing: "Payment processing",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

function normalizeOrderNumber(raw: string): string {
  return raw.trim().toUpperCase();
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function lookupOrderForTracking(
  orderNumberRaw: string,
  emailRaw: string
): Promise<PublicOrderTracking | null> {
  const order_number = normalizeOrderNumber(orderNumberRaw);
  const email = normalizeEmail(emailRaw);

  if (!order_number || !email || !email.includes("@")) {
    return null;
  }

  const supabase = createServiceRoleClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      email,
      status,
      paid_at,
      total_ghs,
      created_at,
      order_items ( name, quantity, sku ),
      payments ( status, created_at ),
      shipments ( carrier, tracking_number, status, created_at )
    `
    )
    .eq("order_number", order_number)
    .maybeSingle();

  if (!order?.id || normalizeEmail(order.email ?? "") !== email) {
    return null;
  }

  const payments = Array.isArray(order.payments) ? order.payments : order.payments ? [order.payments] : [];
  const latestPayment = [...payments].sort(
    (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
  )[0];
  const payment_status =
    order.paid_at || latestPayment?.status === "paid"
      ? "paid"
      : (latestPayment?.status as string) ?? "pending";

  const items = (Array.isArray(order.order_items) ? order.order_items : []).map((row) => ({
    name: String(row.name ?? "Item"),
    quantity: Number(row.quantity ?? 1),
    sku: row.sku != null ? String(row.sku) : null,
  }));

  const shipments = Array.isArray(order.shipments) ? order.shipments : [];
  const tracking = shipments
    .map((s) => ({
      carrier: s.carrier != null ? String(s.carrier) : null,
      tracking_number: s.tracking_number != null ? String(s.tracking_number) : null,
      status: s.status != null ? String(s.status) : null,
      updated_at: String(s.created_at ?? order.created_at),
    }))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const status = String(order.status ?? "pending");

  return {
    order_number: order.order_number,
    status,
    status_label: STATUS_LABELS[status] ?? status,
    payment_status,
    payment_label: PAYMENT_LABELS[payment_status] ?? payment_status,
    placed_at: String(order.created_at),
    total_ghs: Number(order.total_ghs),
    items,
    tracking,
  };
}
