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
  const [{ data: order, error }, { data: items }] = await Promise.all([
    service
      .from("orders")
      .select("id, order_number, email, status, subtotal_ghs, shipping_ghs, tax_ghs, discount_ghs, total_ghs, created_at")
      .eq("id", orderId)
      .maybeSingle(),
    service.from("order_items").select("id, name, sku, unit_price_ghs, quantity").eq("order_id", orderId),
  ]);

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 404 });
  }

  const rows = (items ?? [])
    .map(
      (item) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.sku ?? "-"}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">GHc ${Number(item.unit_price_ghs ?? 0).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${order.order_number}</title>
</head>
<body style="font-family:Arial,sans-serif;padding:24px;color:#111">
  <h1 style="margin:0 0 8px 0;">O & I Label Invoice</h1>
  <p style="margin:0 0 4px 0;"><strong>Order:</strong> ${order.order_number}</p>
  <p style="margin:0 0 4px 0;"><strong>Email:</strong> ${order.email}</p>
  <p style="margin:0 0 12px 0;"><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
  <table style="border-collapse:collapse;width:100%;margin:12px 0;">
    <thead>
      <tr>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Item</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">SKU</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Qty</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Unit</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p><strong>Subtotal:</strong> GHc ${Number(order.subtotal_ghs ?? 0).toFixed(2)}</p>
  <p><strong>Shipping:</strong> GHc ${Number(order.shipping_ghs ?? 0).toFixed(2)}</p>
  <p><strong>Tax:</strong> GHc ${Number(order.tax_ghs ?? 0).toFixed(2)}</p>
  <p><strong>Discount:</strong> GHc ${Number(order.discount_ghs ?? 0).toFixed(2)}</p>
  <p style="font-size:18px;"><strong>Total:</strong> GHc ${Number(order.total_ghs ?? 0).toFixed(2)}</p>
  <script>window.print()</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
