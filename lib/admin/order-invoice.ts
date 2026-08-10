import {
  escapeHtml,
  formatOrderCustomerName,
  formatOrderShippingAddressLines,
  type OrderAddressJson,
} from "@/lib/orders/format-address";
import { isOrderPaid, paymentLabel } from "@/lib/admin/order-status";

export const MAX_BULK_INVOICE_ORDERS = 100;

/** Physical thermal label (MUNBYN ITPP130B). */
export const THERMAL_LABEL = {
  widthMm: 100,
  heightMm: 150,
} as const;

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
  discount_code?: string | null;
  total_ghs: number | null;
  created_at: string;
  paid_at?: string | null;
  payment_status?: "pending" | "processing" | "paid" | "failed" | "refunded" | null;
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

function formatMoney(amount: number): string {
  return `GH₵ ${amount.toFixed(2)}`;
}

function formatInvoiceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Usable height inside 150mm label after ~3.5mm margins. */
const USABLE_HEIGHT_MM = 143;
/** Header + SHIP TO + section chrome on first label (before items). */
const FIRST_HEADER_MM = 42;
/** Compact continuation header. */
const CONT_HEADER_MM = 22;
/** Summary + thank-you footer on last label. */
const FOOTER_MM = 30;
const ITEM_BASE_MM = 7.2;
const ITEM_WRAP_MM = 3.1;
const ITEM_SKU_MM = 2.6;
const CHARS_PER_LINE = 34;

function estimateItemHeightMm(item: OrderInvoiceItem): number {
  const name = item.name.trim() || "Item";
  const nameLines = Math.max(1, Math.ceil(name.length / CHARS_PER_LINE));
  let h = ITEM_BASE_MM + (nameLines - 1) * ITEM_WRAP_MM;
  if (item.sku?.trim()) h += ITEM_SKU_MM;
  return Math.min(h, 22);
}

/**
 * Split items across thermal labels using height estimates.
 * Reserves footer space on every page so the last label never overflows
 * when totals + thank-you are attached. Not a hard-coded product count.
 */
export function paginateInvoiceItems(items: OrderInvoiceItem[]): OrderInvoiceItem[][] {
  if (!items.length) return [[]];

  const pages: OrderInvoiceItem[][] = [];
  let current: OrderInvoiceItem[] = [];

  const itemBudget = (pageIndex: number) => {
    const header = pageIndex === 0 ? FIRST_HEADER_MM : CONT_HEADER_MM;
    return USABLE_HEIGHT_MM - header - FOOTER_MM;
  };

  for (const item of items) {
    const h = estimateItemHeightMm(item);
    const pageIndex = pages.length;
    const used = current.reduce((sum, i) => sum + estimateItemHeightMm(i), 0);
    const budget = itemBudget(pageIndex);

    if (current.length > 0 && used + h > budget) {
      pages.push(current);
      current = [item];
      continue;
    }
    current.push(item);
  }

  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

function paymentBadgeHtml(order: OrderInvoiceOrder): string {
  const label = paymentLabel({
    payment_status: order.payment_status ?? null,
    paid_at: order.paid_at ?? null,
  });
  const paid = isOrderPaid({
    payment_status: order.payment_status ?? null,
    paid_at: order.paid_at ?? null,
  });
  const mark = paid ? "✓ " : "";
  return `<span class="pay-badge${paid ? " pay-badge--paid" : ""}">${mark}${escapeHtml(label)}</span>`;
}

function shipBlockHtml(order: OrderInvoiceOrder): string {
  const name = formatOrderCustomerName(order.shipping_address);
  const lines = formatOrderShippingAddressLines(order.shipping_address, order.phone);
  const phone =
    order.phone?.trim() ||
    (order.shipping_address &&
    typeof order.shipping_address === "object" &&
    !Array.isArray(order.shipping_address) &&
    typeof order.shipping_address.phone === "string"
      ? order.shipping_address.phone.trim()
      : "");

  const addressLines = lines.filter((l) => l !== name && l !== phone);

  if (!name && !addressLines.length && !phone) {
    return `<p class="muted">No delivery address recorded</p>`;
  }

  const parts: string[] = [];
  if (name) parts.push(`<p class="ship-name">${escapeHtml(name)}</p>`);
  for (const line of addressLines) {
    parts.push(`<p class="ship-line">${escapeHtml(line)}</p>`);
  }
  if (phone) parts.push(`<p class="ship-phone">${escapeHtml(phone)}</p>`);
  return parts.join("");
}

function itemRowHtml(item: OrderInvoiceItem, index: number): string {
  const name = item.name.trim() || "Item";
  const sku = item.sku?.trim();
  const qty = Number(item.quantity ?? 0);
  const unit = Number(item.unit_price_ghs ?? 0);
  return `<div class="item">
    <div class="item-main">
      <p class="item-name"><span class="item-idx">${index}.</span> ${escapeHtml(name)}</p>
      ${sku ? `<p class="item-sku">SKU: ${escapeHtml(sku)}</p>` : ""}
    </div>
    <div class="item-meta">
      <p class="item-qty">×${qty}</p>
      <p class="item-price">${escapeHtml(formatMoney(unit))}</p>
    </div>
  </div>`;
}

function summaryHtml(order: OrderInvoiceOrder): string {
  const subtotal = Number(order.subtotal_ghs ?? 0);
  const shipping = Number(order.shipping_ghs ?? 0);
  const tax = Number(order.tax_ghs ?? 0);
  const discount = Number(order.discount_ghs ?? 0);
  const total = Number(order.total_ghs ?? 0);

  const rows: string[] = [
    `<div class="sum-row"><span>Subtotal</span><span>${escapeHtml(formatMoney(subtotal))}</span></div>`,
  ];

  rows.push(
    shipping > 0
      ? `<div class="sum-row"><span>Shipping</span><span>${escapeHtml(formatMoney(shipping))}</span></div>`
      : `<div class="sum-row"><span>Shipping</span><span>FREE</span></div>`
  );

  if (discount > 0) {
    const code = order.discount_code?.trim();
    rows.push(
      `<div class="sum-row"><span>Discount${code ? ` (${escapeHtml(code)})` : ""}</span><span>−${escapeHtml(formatMoney(discount))}</span></div>`
    );
  }

  if (tax > 0) {
    rows.push(
      `<div class="sum-row"><span>Tax</span><span>${escapeHtml(formatMoney(tax))}</span></div>`
    );
  }

  rows.push(
    `<div class="sum-row sum-total"><span>TOTAL</span><span>${escapeHtml(formatMoney(total))}</span></div>`
  );

  return `<div class="summary">${rows.join("")}</div>`;
}

function trackingHtml(shipment: OrderInvoiceShipment): string {
  if (!shipment?.tracking_number?.trim() && !shipment?.carrier?.trim()) return "";
  const text = [shipment.carrier, shipment.tracking_number].filter(Boolean).join(" — ");
  return `<p class="tracking"><strong>Tracking</strong> ${escapeHtml(text)}</p>`;
}

function buildLabelHtml(opts: {
  order: OrderInvoiceOrder;
  items: OrderInvoiceItem[];
  shipment: OrderInvoiceShipment;
  itemOffset: number;
  labelIndex: number;
  labelCount: number;
  isLast: boolean;
  pageBreakAfter: boolean;
}): string {
  const continuation = opts.labelIndex > 1;
  const labelOf =
    opts.labelCount > 1
      ? `<p class="label-of">LABEL ${opts.labelIndex} OF ${opts.labelCount}</p>`
      : "";

  const header = continuation
    ? `<header class="label-header label-header--compact">
        <div class="brand-row">
          <p class="brand">O &amp; I LABEL</p>
          ${labelOf}
        </div>
        <p class="order-no">${escapeHtml(opts.order.order_number)}</p>
        <div class="ship-compact">${shipBlockHtml(opts.order)}</div>
      </header>`
    : `<header class="label-header">
        <div class="brand-row">
          <div>
            <p class="brand">O &amp; I LABEL</p>
            <p class="doc-title">PACKING SLIP</p>
          </div>
          ${labelOf}
        </div>
        <div class="meta-grid">
          <div>
            <p class="meta-label">ORDER</p>
            <p class="meta-value">${escapeHtml(opts.order.order_number)}</p>
          </div>
          <div>
            <p class="meta-label">DATE</p>
            <p class="meta-value">${escapeHtml(formatInvoiceDate(opts.order.created_at))}</p>
          </div>
          <div>
            <p class="meta-label">PAYMENT</p>
            <p class="meta-value">${paymentBadgeHtml(opts.order)}</p>
          </div>
        </div>
        ${trackingHtml(opts.shipment)}
      </header>
      <section class="ship">
        <p class="section-label">SHIP TO</p>
        ${shipBlockHtml(opts.order)}
      </section>`;

  const itemsHtml = opts.items.length
    ? opts.items.map((item, i) => itemRowHtml(item, opts.itemOffset + i + 1)).join("")
    : `<p class="muted">No line items</p>`;

  const footer = opts.isLast
    ? `${summaryHtml(opts.order)}
      <footer class="label-footer">
        <p>Thank you for shopping with O &amp; I Label.</p>
        <p class="footer-sub">Premium Women&apos;s Fashion · oandilabel.com</p>
      </footer>`
    : `<p class="continued">Continued on next label →</p>`;

  const breakStyle = opts.pageBreakAfter ? "page-break-after:always;" : "page-break-after:auto;";

  return `<section class="thermal-label" style="${breakStyle}">
  ${header}
  <section class="items">
    <p class="section-label">${continuation ? "ITEMS (CONT.)" : "ORDER ITEMS"}</p>
    ${itemsHtml}
  </section>
  ${footer}
</section>`;
}

/**
 * Build one or more 100×150mm thermal packing-slip labels for a single order.
 */
export function buildOrderInvoiceSection(
  order: OrderInvoiceOrder,
  items: OrderInvoiceItem[],
  shipment: OrderInvoiceShipment,
  opts?: { pageBreakAfter?: boolean }
): string {
  const pages = paginateInvoiceItems(items);
  const labelCount = pages.length;
  let offset = 0;

  return pages
    .map((pageItems, i) => {
      const labelIndex = i + 1;
      const isLast = labelIndex === labelCount;
      // Break between continuation labels; after an order's final label only
      // when another order follows (bulk). Never break after the document's
      // last label — that blank page is what broke one-item prints before.
      const pageBreakAfter = !isLast || opts?.pageBreakAfter === true;
      const html = buildLabelHtml({
        order,
        items: pageItems,
        shipment,
        itemOffset: offset,
        labelIndex,
        labelCount,
        isLast,
        pageBreakAfter,
      });
      offset += pageItems.length;
      return html;
    })
    .join("\n");
}

const THERMAL_CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page {
    size: ${THERMAL_LABEL.widthMm}mm ${THERMAL_LABEL.heightMm}mm;
    margin: 0;
  }
  .screen-stage {
    padding: 24px 16px 48px;
    background: #e8e8e8;
    min-height: 100vh;
  }
  .screen-hint {
    max-width: 100mm;
    margin: 0 auto 12px;
    font-size: 12px;
    color: #555;
  }
  .thermal-label {
    width: ${THERMAL_LABEL.widthMm}mm;
    min-height: ${THERMAL_LABEL.heightMm}mm;
    max-width: ${THERMAL_LABEL.widthMm}mm;
    margin: 0 auto 20px;
    padding: 3.5mm 3.8mm 3.2mm;
    background: #fff;
    border: 1px solid #ccc;
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    gap: 2.2mm;
  }
  .brand {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.1;
  }
  .doc-title {
    margin: 1px 0 0;
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .brand-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 4px;
  }
  .label-of {
    margin: 0;
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: 1.2fr 0.9fr 0.9fr;
    gap: 2mm;
    margin-top: 2mm;
    padding-top: 2mm;
    border-top: 1.5px solid #000;
  }
  .meta-label {
    margin: 0;
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .meta-value {
    margin: 1px 0 0;
    font-size: 9px;
    font-weight: 600;
    line-height: 1.25;
    word-break: break-word;
  }
  .pay-badge {
    display: inline-block;
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    border: 1.5px solid #000;
    padding: 1px 4px;
    line-height: 1.2;
  }
  .pay-badge--paid {
    background: #000;
    color: #fff;
  }
  .tracking {
    margin: 1.5mm 0 0;
    font-size: 8px;
    line-height: 1.3;
  }
  .section-label {
    margin: 0 0 1mm;
    font-size: 7.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 0.8mm;
  }
  .ship-name {
    margin: 0 0 0.6mm;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
    text-transform: uppercase;
  }
  .ship-line {
    margin: 0 0 0.4mm;
    font-size: 9px;
    line-height: 1.25;
    word-break: break-word;
  }
  .ship-phone {
    margin: 1mm 0 0;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .ship-compact .ship-name { font-size: 10px; }
  .ship-compact .ship-line { font-size: 8px; }
  .ship-compact .ship-phone { font-size: 9.5px; margin-top: 0.5mm; }
  .order-no {
    margin: 0.8mm 0;
    font-size: 10px;
    font-weight: 700;
  }
  .item {
    display: flex;
    justify-content: space-between;
    gap: 2mm;
    padding: 1.2mm 0;
    border-bottom: 0.5px solid #bbb;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .item:last-child { border-bottom: none; }
  .item-main { min-width: 0; flex: 1; }
  .item-name {
    margin: 0;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.25;
    word-break: break-word;
  }
  .item-idx { font-weight: 800; }
  .item-sku {
    margin: 0.4mm 0 0;
    font-size: 7.5px;
    line-height: 1.2;
    word-break: break-all;
  }
  .item-meta {
    text-align: right;
    flex-shrink: 0;
  }
  .item-qty {
    margin: 0;
    font-size: 10px;
    font-weight: 800;
  }
  .item-price {
    margin: 0.3mm 0 0;
    font-size: 7.5px;
  }
  .summary {
    margin-top: auto;
    padding-top: 1.5mm;
    border-top: 1.5px solid #000;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    gap: 2mm;
    font-size: 8.5px;
    line-height: 1.35;
    margin: 0.3mm 0;
  }
  .sum-total {
    margin-top: 1mm;
    padding-top: 1mm;
    border-top: 1px solid #000;
    font-size: 11px;
    font-weight: 800;
  }
  .label-footer {
    break-inside: avoid;
    page-break-inside: avoid;
    padding-top: 1mm;
    border-top: 0.5px solid #999;
  }
  .label-footer p {
    margin: 0;
    font-size: 7.5px;
    line-height: 1.3;
    text-align: center;
  }
  .footer-sub {
    margin-top: 0.4mm !important;
  }
  .continued {
    margin: auto 0 0;
    font-size: 8px;
    font-weight: 700;
    text-align: right;
  }
  .muted {
    margin: 0;
    font-size: 8px;
  }

  @media print {
    .no-print { display: none !important; }
    .screen-stage {
      padding: 0 !important;
      background: #fff !important;
      min-height: 0 !important;
    }
    .thermal-label {
      width: ${THERMAL_LABEL.widthMm}mm !important;
      min-height: 0 !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
      /* Do not set max-height — clipping is forbidden; pagination handles overflow. */
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
`;

export function buildInvoiceHtmlDocument(opts: {
  title: string;
  sections: string[];
  autoPrint?: boolean;
  footerNote?: string;
}): string {
  const sections = opts.sections.join("\n");
  const printScript = opts.autoPrint !== false ? "<script>window.print()</script>" : "";
  const footer = opts.footerNote
    ? `<p class="no-print screen-hint">${escapeHtml(opts.footerNote)}</p>`
    : `<p class="no-print screen-hint">Print tip: paper size 100mm × 150mm · Margins None · Scale 100%.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  <style>${THERMAL_CSS}</style>
</head>
<body>
  <div class="screen-stage">
    ${footer}
    ${sections}
  </div>
  ${printScript}
</body>
</html>`;
}

export function buildInvoiceErrorHtml(message: string): string {
  return buildInvoiceHtmlDocument({
    title: "Print packing slips",
    sections: [
      `<section class="thermal-label" style="page-break-after:auto;">
        <p class="brand">O &amp; I LABEL</p>
        <p style="margin-top:8px;font-size:11px;color:#b91c1c;">${escapeHtml(message)}</p>
      </section>`,
    ],
    autoPrint: false,
  });
}
