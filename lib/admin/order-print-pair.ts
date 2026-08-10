import {
  buildInvoiceHtmlDocument,
  buildOrderInvoiceSection,
  type OrderInvoiceItem,
  type OrderInvoiceOrder,
  type OrderInvoiceShipment,
} from "@/lib/admin/order-invoice";
import {
  buildShippingLabelSection,
  SHIPPING_LABEL_CSS,
  validateShippingLabelOrder,
  type ShippingLabelOrder,
} from "@/lib/admin/order-shipping-label";

export type PairedPrintOrder = {
  invoice: OrderInvoiceOrder;
  items: OrderInvoiceItem[];
  shipment: OrderInvoiceShipment;
};

/**
 * Build print HTML for one or more orders as:
 * Packing slip → Shipping label → next order…
 * Selection order is preserved. Packing slip rendering is unchanged.
 */
export function buildPairedOrdersPrintHtml(opts: {
  orders: PairedPrintOrder[];
  title: string;
  autoPrint?: boolean;
  footerNote?: string;
}): string {
  const total = opts.orders.length;
  const sections: string[] = [];

  opts.orders.forEach((entry, index) => {
    const isLastOrder = index === total - 1;
    const orderIndex = index + 1;

    // Packing slip (frozen renderer) — always break after so shipping is next page.
    sections.push(
      buildOrderInvoiceSection(entry.invoice, entry.items, entry.shipment, {
        pageBreakAfter: true,
      })
    );

    const shipOrder: ShippingLabelOrder = {
      order_number: entry.invoice.order_number,
      phone: entry.invoice.phone,
      shipping_address: entry.invoice.shipping_address,
    };

    sections.push(
      buildShippingLabelSection(shipOrder, {
        pageBreakAfter: !isLastOrder,
        orderIndex,
        orderCount: total,
      })
    );
  });

  const labelCount = total * 2;
  const defaultNote = `${total} order(s) · ${labelCount} labels (packing slip → shipping label per order). Paper: 100mm × 150mm · Margins None · Scale 100%.`;

  return buildInvoiceHtmlDocument({
    title: opts.title,
    sections,
    autoPrint: opts.autoPrint,
    footerNote: opts.footerNote ?? defaultNote,
    extraCss: SHIPPING_LABEL_CSS,
  });
}

export function shippingLabelBlockingIssues(
  orders: Array<{ order_number: string; phone: string | null; shipping_address: ShippingLabelOrder["shipping_address"] }>
): string[] {
  const issues: string[] = [];
  for (const order of orders) {
    const v = validateShippingLabelOrder(order);
    if (!v.ok) {
      issues.push(`${order.order_number || "Order"}: missing ${v.missing.join(", ")}`);
    }
  }
  return issues;
}
