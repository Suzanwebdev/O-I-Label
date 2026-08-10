import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  buildInvoiceErrorHtml,
  MAX_BULK_INVOICE_ORDERS,
  type OrderInvoiceItem,
  type OrderInvoiceOrder,
  type OrderInvoiceShipment,
} from "@/lib/admin/order-invoice";
import {
  buildPairedOrdersPrintHtml,
  shippingLabelBlockingIssues,
  type PairedPrintOrder,
} from "@/lib/admin/order-print-pair";
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

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Batch paired print: for each selected id (selection order preserved):
 * packing slip → shipping label.
 */
export async function GET(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orderIds = parseOrderIds(new URL(request.url));
  if (!orderIds.length) {
    return htmlResponse(buildInvoiceErrorHtml("No orders selected."), 400);
  }
  if (orderIds.length > MAX_BULK_INVOICE_ORDERS) {
    return htmlResponse(
      buildInvoiceErrorHtml(
        `You can print at most ${MAX_BULK_INVOICE_ORDERS} orders at once. Narrow your selection.`
      ),
      400
    );
  }

  const service = createServiceRoleClient();
  const [
    { data: orders, error: ordersError },
    { data: items },
    { data: shipments },
    { data: allPayments },
  ] = await Promise.all([
    service
      .from("orders")
      .select(
        "id, order_number, email, phone, status, shipping_address, subtotal_ghs, shipping_ghs, tax_ghs, discount_ghs, discount_code, total_ghs, created_at, paid_at"
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
    service.from("payments").select("order_id, status").in("order_id", orderIds),
  ]);

  if (ordersError) {
    return htmlResponse(buildInvoiceErrorHtml(ordersError.message), 500);
  }

  const orderById = new Map((orders ?? []).map((o) => [o.id as string, o]));
  const sorted = orderIds
    .map((id) => orderById.get(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  if (!sorted.length) {
    return htmlResponse(buildInvoiceErrorHtml("None of the selected orders were found."), 404);
  }

  const paymentsByOrder = new Map<string, string[]>();
  for (const p of allPayments ?? []) {
    const orderId = p.order_id as string;
    const list = paymentsByOrder.get(orderId) ?? [];
    list.push(String(p.status ?? ""));
    paymentsByOrder.set(orderId, list);
  }

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

  const paired: PairedPrintOrder[] = sorted.map((order) => {
    const statuses = paymentsByOrder.get(order.id as string) ?? [];
    const payment_status = (
      statuses.includes("paid") ? "paid" : statuses[0] ?? null
    ) as OrderInvoiceOrder["payment_status"];

    const invoice: OrderInvoiceOrder = {
      order_number: String(order.order_number ?? ""),
      email: String(order.email ?? ""),
      phone: order.phone == null ? null : String(order.phone),
      status: String(order.status ?? ""),
      shipping_address: order.shipping_address as OrderAddressJson,
      subtotal_ghs: order.subtotal_ghs != null ? Number(order.subtotal_ghs) : null,
      shipping_ghs: order.shipping_ghs != null ? Number(order.shipping_ghs) : null,
      tax_ghs: order.tax_ghs != null ? Number(order.tax_ghs) : null,
      discount_ghs: order.discount_ghs != null ? Number(order.discount_ghs) : null,
      discount_code: order.discount_code ?? null,
      total_ghs: order.total_ghs != null ? Number(order.total_ghs) : null,
      created_at: String(order.created_at ?? new Date(0).toISOString()),
      paid_at: order.paid_at == null ? null : String(order.paid_at),
      payment_status,
    };

    return {
      invoice,
      items: itemsByOrder.get(order.id as string) ?? [],
      shipment: shipmentByOrder.get(order.id as string) ?? null,
    };
  });

  const issues = shippingLabelBlockingIssues(
    paired.map((p) => ({
      order_number: p.invoice.order_number,
      phone: p.invoice.phone,
      shipping_address: p.invoice.shipping_address,
    }))
  );

  const footerNote =
    issues.length > 0
      ? `${paired.length} order(s) · ${paired.length * 2} labels. Shipping issues: ${issues.join(" | ")}. Paper: 100mm × 150mm · Margins None · Scale 100%.`
      : undefined;

  const html = buildPairedOrdersPrintHtml({
    title:
      paired.length === 1
        ? `Print order ${paired[0]?.invoice.order_number ?? ""}`
        : `Print orders (${paired.length})`,
    orders: paired,
    footerNote,
  });

  return htmlResponse(html);
}
