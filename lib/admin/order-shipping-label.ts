import {
  escapeHtml,
  formatOrderCustomerName,
  formatOrderShippingAddressLines,
  type OrderAddressJson,
} from "@/lib/orders/format-address";
import { THERMAL_LABEL } from "@/lib/admin/order-invoice";

export type ShippingLabelOrder = {
  order_number: string;
  phone: string | null;
  shipping_address: OrderAddressJson;
};

export type ShippingLabelValidation =
  | { ok: true }
  | { ok: false; missing: string[] };

/** Check fields required for a usable external shipping label. */
export function validateShippingLabelOrder(order: ShippingLabelOrder): ShippingLabelValidation {
  const missing: string[] = [];
  const name = formatOrderCustomerName(order.shipping_address);
  const phone =
    order.phone?.trim() ||
    (order.shipping_address &&
    typeof order.shipping_address === "object" &&
    !Array.isArray(order.shipping_address) &&
    typeof order.shipping_address.phone === "string"
      ? order.shipping_address.phone.trim()
      : "");

  const lines = formatOrderShippingAddressLines(order.shipping_address, order.phone);
  const addressLines = lines.filter((l) => l !== name && l !== phone);

  if (!name) missing.push("customer name");
  if (!addressLines.length) missing.push("delivery address");
  if (!phone) missing.push("phone number");
  if (!order.order_number?.trim()) missing.push("order number");

  return missing.length ? { ok: false, missing } : { ok: true };
}

function deliverToHtml(order: ShippingLabelOrder): string {
  const name = formatOrderCustomerName(order.shipping_address);
  const phone =
    order.phone?.trim() ||
    (order.shipping_address &&
    typeof order.shipping_address === "object" &&
    !Array.isArray(order.shipping_address) &&
    typeof order.shipping_address.phone === "string"
      ? order.shipping_address.phone.trim()
      : "");
  const lines = formatOrderShippingAddressLines(order.shipping_address, order.phone);
  const addressLines = lines.filter((l) => l !== name && l !== phone);

  const location =
    addressLines.length > 1 && addressLines.join(", ").length <= 80
      ? addressLines.join(", ")
      : null;

  const parts: string[] = [];
  if (name) parts.push(`<p class="ship-label-name">${escapeHtml(name)}</p>`);
  if (location) {
    parts.push(`<p class="ship-label-addr">${escapeHtml(location)}</p>`);
  } else {
    for (const line of addressLines) {
      parts.push(`<p class="ship-label-addr">${escapeHtml(line)}</p>`);
    }
  }
  if (phone) parts.push(`<p class="ship-label-phone">${escapeHtml(phone)}</p>`);
  return parts.join("");
}

/**
 * One 100×150mm external shipping label. No products, prices, email, or payment info.
 */
export function buildShippingLabelSection(
  order: ShippingLabelOrder,
  opts?: {
    pageBreakAfter?: boolean;
    /** Optional batch position: ORDER n OF m (orders, not labels). */
    orderIndex?: number;
    orderCount?: number;
  }
): string {
  const validation = validateShippingLabelOrder(order);
  const breakStyle = opts?.pageBreakAfter ? "page-break-after:always;" : "page-break-after:auto;";
  const batchHint =
    opts?.orderIndex != null &&
    opts?.orderCount != null &&
    opts.orderCount > 1
      ? `<p class="ship-label-batch">ORDER ${opts.orderIndex} OF ${opts.orderCount}</p>`
      : "";

  if (!validation.ok) {
    return `<section class="shipping-label" style="${breakStyle}">
  <header class="ship-label-header">
    <p class="ship-label-brand">O &amp; I LABEL</p>
    <p class="ship-label-doc">SHIPPING LABEL</p>
    <p class="ship-label-role">OUTSIDE PACKAGE</p>
  </header>
  <p class="ship-label-error">Cannot print shipping label for ${escapeHtml(order.order_number || "this order")}.</p>
  <p class="ship-label-error-detail">Missing: ${escapeHtml(validation.missing.join(", "))}.</p>
</section>`;
  }

  return `<section class="shipping-label" style="${breakStyle}">
  <header class="ship-label-header">
    <p class="ship-label-brand">O &amp; I LABEL</p>
    <p class="ship-label-doc">SHIPPING LABEL</p>
    <p class="ship-label-role">OUTSIDE PACKAGE</p>
    ${batchHint}
  </header>
  <section class="ship-label-deliver">
    <p class="ship-label-section">DELIVER TO</p>
    ${deliverToHtml(order)}
  </section>
  <section class="ship-label-order">
    <p class="ship-label-section">ORDER</p>
    <p class="ship-label-order-no">${escapeHtml(order.order_number)}</p>
  </section>
  <footer class="ship-label-footer">
    <p>O &amp; I LABEL</p>
    <p>Premium Women&apos;s Fashion • oandilabel.com</p>
  </footer>
</section>`;
}

/** CSS for `.shipping-label` only — does not alter packing-slip styles. */
export const SHIPPING_LABEL_CSS = `
  .shipping-label {
    width: ${THERMAL_LABEL.widthMm}mm;
    min-height: ${THERMAL_LABEL.heightMm}mm;
    max-width: ${THERMAL_LABEL.widthMm}mm;
    margin: 0 auto 20px;
    padding: 5mm 4.5mm 4mm;
    background: #fff;
    border: 1px solid #ccc;
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    gap: 4mm;
    color: #000;
  }
  .ship-label-brand {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.06em;
    line-height: 1.1;
  }
  .ship-label-doc {
    margin: 1.5mm 0 0;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
  }
  .ship-label-role {
    margin: 1mm 0 0;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }
  .ship-label-batch {
    margin: 2mm 0 0;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .ship-label-section {
    margin: 0 0 2mm;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.14em;
    border-bottom: 1.5px solid #000;
    padding-bottom: 1mm;
  }
  .ship-label-name {
    margin: 0 0 2mm;
    font-size: 18px;
    font-weight: 800;
    line-height: 1.15;
    text-transform: uppercase;
    word-break: break-word;
  }
  .ship-label-addr {
    margin: 0 0 1.2mm;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    word-break: break-word;
  }
  .ship-label-phone {
    margin: 3mm 0 0;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.03em;
  }
  .ship-label-order-no {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.02em;
    word-break: break-word;
  }
  .ship-label-footer {
    margin-top: auto;
    padding-top: 3mm;
    border-top: 1px solid #000;
    text-align: center;
  }
  .ship-label-footer p {
    margin: 0;
    font-size: 8px;
    font-weight: 600;
    line-height: 1.35;
  }
  .ship-label-error {
    margin: 4mm 0 0;
    font-size: 12px;
    font-weight: 800;
    color: #000;
  }
  .ship-label-error-detail {
    margin: 2mm 0 0;
    font-size: 10px;
    font-weight: 600;
  }

  @media print {
    .shipping-label {
      width: ${THERMAL_LABEL.widthMm}mm !important;
      min-height: 0 !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
`;
