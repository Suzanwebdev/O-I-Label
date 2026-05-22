import {
  escapeHtml,
  formatOrderShippingAddressLines,
  type OrderAddressJson,
} from "@/lib/orders/format-address";
import { isOrderPaid } from "@/lib/admin/order-status";

export const MAX_BULK_INVOICE_ORDERS = 100;

export type OrderInvoiceOrder = {
  order_number: string;
  email: string;
  phone: string | null;
  status: string;
  shipping_address: OrderAddressJson;
  subtotal_ghs: number | null;
  shipping_ghs: number | null;
  tax_ghs: number | null;
  discount_ghs: number | null;
  total_ghs: number | null;
  created_at: string;
};

export type OrderInvoiceItem = {
  name: string;
  sku: string | null;
  unit_price_ghs: number | null;
  quantity: number;
};

export type OrderInvoiceShipment = {
  tracking_number: string | null;
  carrier: string | null;
} | null;

export function buildOrderInvoiceSection(
  order: OrderInvoiceOrder,
  items: OrderInvoiceItem[],
  shipment: OrderInvoiceShipment,
  opts?: { pageBreakAfter?: boolean }
): string {
  const pageBreak = opts?.pageBreakAfter !== false ? "page-break-after:always;" : "";
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

  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.sku ?? "-")}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">GHc ${Number(item.unit_price_ghs ?? 0).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `<section class="invoice-page" style="${pageBreak}max-width:800px;margin:0 auto;padding:24px;">
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
</section>`;
}

export function buildInvoiceHtmlDocument(opts: {
  title: string;
  sections: string[];
  autoPrint?: boolean;
  footerNote?: string;
}): string {
  const lastPageBreak =
    opts.sections.length > 1
      ? `<style>@media print { .invoice-page:last-child { page-break-after: auto; } }</style>`
      : "";
  const sections = opts.sections.join("\n");
  const printScript = opts.autoPrint !== false ? "<script>window.print()</script>" : "";
  const footer = opts.footerNote
    ? `<p class="no-print" style="margin:24px auto 0;max-width:800px;padding:0 24px;font-size:12px;color:#888;">${escapeHtml(opts.footerNote)}</p>`
    : `<p class="no-print" style="margin:24px auto 0;max-width:800px;padding:0 24px;font-size:12px;color:#888;">Use your browser print dialog to save as PDF.</p>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
    @media print { body { margin: 0; } .no-print { display: none; } }
    .invoice-page:last-child { page-break-after: auto; }
  </style>
  ${lastPageBreak}
</head>
<body style="font-family:Arial,sans-serif;color:#111;">
  ${sections}
  ${footer}
  ${printScript}
</body>
</html>`;
}

export function buildInvoiceErrorHtml(message: string): string {
  return buildInvoiceHtmlDocument({
    title: "Print invoices",
    sections: [
      `<section style="max-width:800px;margin:0 auto;padding:24px;"><p style="color:#b91c1c;">${escapeHtml(message)}</p></section>`,
    ],
    autoPrint: false,
  });
}

export { isOrderPaid };
