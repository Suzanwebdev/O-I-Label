import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  escapeHtml,
  formatOrderShippingAddressLines,
} from "@/lib/orders/format-address";

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

  const shipLines = formatOrderShippingAddressLines(order.shipping_address, order.phone);
  const shipHtml = shipLines.length
    ? shipLines.map((line) => `<p style="margin:0 0 4px 0;">${escapeHtml(line)}</p>`).join("")
    : `<p style="margin:0;color:#666;">No delivery address recorded</p>`;

  const tracking =
    shipment?.tracking_number?.trim() || shipment?.carrier?.trim()
      ? `<p style="margin:8px 0 0 0;"><strong>Tracking:</strong> ${escapeHtml(
          [shipment.carrier, shipment.tracking_number].filter(Boolean).join(" — ")
        )}</p>`
      : "";

  const rows = (items ?? [])
    .map(
      (item) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.sku ?? "-")}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">GHc ${Number(item.unit_price_ghs ?? 0).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(order.order_number)}</title>
  <style>
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body style="font-family:Arial,sans-serif;padding:24px;color:#111;max-width:800px;margin:0 auto;">
  <h1 style="margin:0 0 4px 0;font-size:22px;">O &amp; I Label</h1>
  <p style="margin:0 0 16px 0;color:#555;font-size:13px;">Delivery invoice / packing slip</p>

  <div style="display:flex;flex-wrap:wrap;gap:24px;margin-bottom:20px;">
    <div style="flex:1;min-width:200px;">
      <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666;">Order</p>
      <p style="margin:0 0 4px 0;"><strong>${escapeHtml(order.order_number)}</strong></p>
      <p style="margin:0 0 4px 0;">Status: ${escapeHtml(order.status)}</p>
      <p style="margin:0;">Date: ${escapeHtml(new Date(order.created_at).toLocaleString())}</p>
      ${tracking}
    </div>
    <div style="flex:1;min-width:220px;border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fafafa;">
      <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666;">Ship to</p>
      <p style="margin:0 0 6px 0;"><strong>Email:</strong> ${escapeHtml(order.email)}</p>
      ${shipHtml}
    </div>
  </div>

  <table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:14px;">
    <thead>
      <tr>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #111;">Item</th>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #111;">SKU</th>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #111;">Qty</th>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #111;">Unit</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:16px;font-size:14px;">
    <p style="margin:4px 0;"><strong>Subtotal:</strong> GHc ${Number(order.subtotal_ghs ?? 0).toFixed(2)}</p>
    <p style="margin:4px 0;"><strong>Shipping:</strong> GHc ${Number(order.shipping_ghs ?? 0).toFixed(2)}</p>
    <p style="margin:4px 0;"><strong>Tax:</strong> GHc ${Number(order.tax_ghs ?? 0).toFixed(2)}</p>
    <p style="margin:4px 0;"><strong>Discount:</strong> GHc ${Number(order.discount_ghs ?? 0).toFixed(2)}</p>
    <p style="margin:12px 0 0 0;font-size:18px;"><strong>Total:</strong> GHc ${Number(order.total_ghs ?? 0).toFixed(2)}</p>
  </div>
  <p class="no-print" style="margin-top:24px;font-size:12px;color:#888;">Use your browser print dialog to save as PDF.</p>
  <script>window.print()</script>
</body>
</html>`;

  return new NextResponse(html.replace(/<motion-safe div/g, "<div").replace(/<\/motion-safe div>/g, "</div>"), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
