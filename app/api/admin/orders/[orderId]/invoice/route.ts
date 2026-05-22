import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  buildInvoiceHtmlDocument,
  buildOrderInvoiceSection,
  type OrderInvoiceItem,
  type OrderInvoiceOrder,
} from "@/lib/admin/order-invoice";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { OrderAddressJson } from "@/lib/orders/format-address";

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
  const [{ data: order, error }, { data: items }, { data: shipment }] = await Promise.all([
    service
      .from("orders")
      .select(
        "id, order_number, email, phone, status, shipping_address, subtotal_ghs, shipping_ghs, tax_ghs, discount_ghs, total_ghs, created_at"
      )
      .eq("id", orderId)
      .maybeSingle(),
    service.from("order_items").select("id, name, sku, unit_price_ghs, quantity").eq("order_id", orderId),
    service
      .from("shipments")
      .select("tracking_number, carrier")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 404 });
  }

  const invoiceOrder: OrderInvoiceOrder = {
    order_number: String(order.order_number ?? ""),
    email: String(order.email ?? ""),
    phone: order.phone == null ? null : String(order.phone),
    status: String(order.status ?? ""),
    shipping_address: order.shipping_address as OrderAddressJson,
    subtotal_ghs: order.subtotal_ghs != null ? Number(order.subtotal_ghs) : null,
    shipping_ghs: order.shipping_ghs != null ? Number(order.shipping_ghs) : null,
    tax_ghs: order.tax_ghs != null ? Number(order.tax_ghs) : null,
    discount_ghs: order.discount_ghs != null ? Number(order.discount_ghs) : null,
    total_ghs: order.total_ghs != null ? Number(order.total_ghs) : null,
    created_at: String(order.created_at ?? new Date(0).toISOString()),
  };

  const invoiceItems: OrderInvoiceItem[] = (items ?? []).map((item) => ({
    name: String(item.name ?? ""),
    sku: item.sku == null ? null : String(item.sku),
    unit_price_ghs: item.unit_price_ghs != null ? Number(item.unit_price_ghs) : null,
    quantity: Number(item.quantity ?? 0),
  }));

  const section = buildOrderInvoiceSection(invoiceOrder, invoiceItems, shipment ?? null, {
    pageBreakAfter: false,
  });
  const html = buildInvoiceHtmlDocument({
    title: `Invoice ${invoiceOrder.order_number}`,
    sections: [section],
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
