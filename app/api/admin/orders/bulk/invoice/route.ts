import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  buildInvoiceErrorHtml,
  buildInvoiceHtmlDocument,
  buildOrderInvoiceSection,
  isOrderPaid,
  MAX_BULK_INVOICE_ORDERS,
  type OrderInvoiceItem,
  type OrderInvoiceOrder,
  type OrderInvoiceShipment,
} from "@/lib/admin/order-invoice";
import type { AdminOrderRow } from "@/lib/data/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { OrderAddressJson } from "@/lib/orders/format-address";

function parseOrderIds(url: URL): string[] {
  const raw = url.searchParams.get("ids")?.trim() ?? "";
  if (!raw) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function invoiceHtmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orderIds = parseOrderIds(new URL(request.url));
  if (!orderIds.length) {
    return invoiceHtmlResponse(buildInvoiceErrorHtml("No orders selected."), 400);
  }
  if (orderIds.length > MAX_BULK_INVOICE_ORDERS) {
    return invoiceHtmlResponse(
      buildInvoiceErrorHtml(
        `You can print at most ${MAX_BULK_INVOICE_ORDERS} orders at once. Narrow your selection or filters.`
      ),
      400
    );
  }

  const service = createServiceRoleClient();
  const [{ data: orders, error: ordersError }, { data: items }, { data: shipments }] = await Promise.all([
    service
      .from("orders")
      .select(
        "id, order_number, email, phone, status, shipping_address, subtotal_ghs, shipping_ghs, tax_ghs, discount_ghs, total_ghs, created_at, payment_status, paid_at"
      )
      .in("id", orderIds),
    service
      .from("order_items")
      .select("order_id, name, sku, unit_price_ghs, quantity")
      .in("order_id", orderIds),
    service
      .from("shipments")
      .select("order_id, tracking_number, carrier, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
  ]);

  if (ordersError) {
    return invoiceHtmlResponse(buildInvoiceErrorHtml(ordersError.message), 500);
  }

  const paid = (orders ?? []).filter((o) =>
    isOrderPaid({
      payment_status: o.payment_status as AdminOrderRow["payment_status"],
      paid_at: o.paid_at == null ? null : String(o.paid_at),
    })
  );

  if (!paid.length) {
    return invoiceHtmlResponse(
      buildInvoiceErrorHtml("No paid orders to print. Unpaid orders are skipped."),
      400
    );
  }

  const orderById = new Map(paid.map((o) => [o.id as string, o]));
  const sorted = orderIds
    .map((id) => orderById.get(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const itemsByOrder = new Map<string, OrderInvoiceItem[]>();
  for (const row of items ?? []) {
    const orderId = row.order_id as string;
    const list = itemsByOrder.get(orderId) ?? [];
    list.push({
      name: String(row.name ?? ""),
      sku: row.sku == null ? null : String(row.sku),
      unit_price_ghs: row.unit_price_ghs != null ? Number(row.unit_price_ghs) : null,
      quantity: Number(row.quantity ?? 0),
    });
    itemsByOrder.set(orderId, list);
  }

  const shipmentByOrder = new Map<string, OrderInvoiceShipment>();
  for (const row of shipments ?? []) {
    const orderId = row.order_id as string;
    if (shipmentByOrder.has(orderId)) continue;
    shipmentByOrder.set(orderId, {
      tracking_number: row.tracking_number == null ? null : String(row.tracking_number),
      carrier: row.carrier == null ? null : String(row.carrier),
    });
  }

  const sections = sorted.map((order) => {
    const o: OrderInvoiceOrder = {
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
    return buildOrderInvoiceSection(
      o,
      itemsByOrder.get(order.id as string) ?? [],
      shipmentByOrder.get(order.id as string) ?? null
    );
  });

  const skippedUnpaid = orderIds.length - paid.length;
  const footerNote =
    skippedUnpaid > 0
      ? `Printed ${sections.length} paid order(s). ${skippedUnpaid} unpaid skipped. Use your browser print dialog to save as PDF.`
      : undefined;

  const html = buildInvoiceHtmlDocument({
    title: sections.length === 1 ? `Invoice ${sorted[0]?.order_number ?? ""}` : `Invoices (${sections.length})`,
    sections,
    footerNote,
  });

  return invoiceHtmlResponse(html);
}
