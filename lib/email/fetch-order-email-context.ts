import type { SupabaseClient } from "@supabase/supabase-js";
import { orderItemImageFromRow } from "@/lib/email/product-image-url";
import { formatOrderCustomerName } from "@/lib/orders/format-address";

export type OrderEmailLineItem = {
  name: string;
  imageUrl: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPriceGhs: number;
  lineTotalGhs: number;
};

export type OrderEmailContext = {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  email: string;
  subtotalGhs: number;
  shippingGhs: number;
  taxGhs: number;
  discountGhs: number;
  totalGhs: number;
  createdAt: string;
  items: OrderEmailLineItem[];
};

export async function fetchOrderEmailContext(
  service: SupabaseClient,
  orderId: string
): Promise<OrderEmailContext | null> {
  const { data: order, error } = await service
    .from("orders")
    .select(
      "id, order_number, email, subtotal_ghs, shipping_ghs, tax_ghs, discount_ghs, total_ghs, created_at, shipping_address"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) return null;

  const { data: rows } = await service
    .from("order_items")
    .select(
      `
      name,
      quantity,
      unit_price_ghs,
      variants ( size, color ),
      products ( product_images ( storage_path, sort_order ) )
    `
    )
    .eq("order_id", orderId);

  const shippingAddress =
    order.shipping_address && typeof order.shipping_address === "object" && !Array.isArray(order.shipping_address)
      ? (order.shipping_address as Record<string, unknown>)
      : null;

  const items: OrderEmailLineItem[] = (rows ?? []).map((row) => {
    const variant = Array.isArray(row.variants) ? row.variants[0] : row.variants;
    const qty = Number(row.quantity ?? 1);
    const unit = Number(row.unit_price_ghs ?? 0);
    const size =
      variant && typeof variant === "object" && "size" in variant && variant.size
        ? String(variant.size)
        : null;
    const color =
      variant && typeof variant === "object" && "color" in variant && variant.color
        ? String(variant.color)
        : null;
    return {
      name: String(row.name ?? "Item"),
      imageUrl: orderItemImageFromRow(row.products),
      size,
      color,
      quantity: qty,
      unitPriceGhs: unit,
      lineTotalGhs: unit * qty,
    };
  });

  return {
    orderId: order.id as string,
    orderNumber: String(order.order_number ?? ""),
    customerName: formatOrderCustomerName(shippingAddress),
    email: String(order.email ?? ""),
    subtotalGhs: Number(order.subtotal_ghs ?? 0),
    shippingGhs: Number(order.shipping_ghs ?? 0),
    taxGhs: Number(order.tax_ghs ?? 0),
    discountGhs: Number(order.discount_ghs ?? 0),
    totalGhs: Number(order.total_ghs ?? 0),
    createdAt: String(order.created_at ?? new Date().toISOString()),
    items,
  };
}
