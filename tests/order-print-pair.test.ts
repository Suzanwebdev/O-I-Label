import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPairedOrdersPrintHtml,
  shippingLabelBlockingIssues,
} from "../lib/admin/order-print-pair.ts";
import {
  buildShippingLabelSection,
  validateShippingLabelOrder,
} from "../lib/admin/order-shipping-label.ts";
import type { OrderInvoiceOrder } from "../lib/admin/order-invoice.ts";

const sampleOrder: OrderInvoiceOrder = {
  order_number: "OI-TEST0001",
  email: "guest@example.com",
  phone: "0559591823",
  status: "paid",
  shipping_address: {
    first_name: "Ama",
    last_name: "Nuella",
    address: "Gbwe",
    city: "Accra",
    region: "Greater Accra",
    phone: "0559591823",
  },
  subtotal_ghs: 180,
  shipping_ghs: 0,
  tax_ghs: 0,
  discount_ghs: 0,
  total_ghs: 180,
  created_at: "2026-08-10T12:00:00.000Z",
  paid_at: "2026-08-10T12:05:00.000Z",
  payment_status: "paid",
};

describe("shipping label privacy", () => {
  it("omits email, products, prices, and payment from the shipping label", () => {
    const html = buildShippingLabelSection(
      {
        order_number: sampleOrder.order_number,
        phone: sampleOrder.phone,
        shipping_address: sampleOrder.shipping_address,
      },
      { pageBreakAfter: false }
    );
    assert.match(html, /SHIPPING LABEL/);
    assert.match(html, /OUTSIDE PACKAGE/);
    assert.match(html, /OI-TEST0001/);
    assert.match(html, /Ama Nuella/i);
    assert.match(html, /0559591823/);
    assert.doesNotMatch(html, /guest@example.com/);
    assert.doesNotMatch(html, /Subtotal|TOTAL|PAID|SKU|Fitted Dress|GH₵/i);
  });

  it("flags missing phone and address", () => {
    const bad = validateShippingLabelOrder({
      order_number: "OI-X",
      phone: null,
      shipping_address: { first_name: "Only" },
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.ok(bad.missing.includes("phone number"));
      assert.ok(bad.missing.includes("delivery address"));
    }
  });
});

describe("paired print sequence", () => {
  it("prints packing slip then shipping label for each order in selection order", () => {
    const orderB: OrderInvoiceOrder = {
      ...sampleOrder,
      order_number: "OI-TEST0002",
      shipping_address: {
        first_name: "Kojo",
        last_name: "Mensah",
        address: "East Legon",
        city: "Accra",
        region: "Greater Accra",
        phone: "0244000000",
      },
      phone: "0244000000",
    };

    const html = buildPairedOrdersPrintHtml({
      title: "Print orders",
      autoPrint: false,
      orders: [
        {
          invoice: sampleOrder,
          items: [{ name: "Dress", sku: "sku-1", unit_price_ghs: 100, quantity: 1 }],
          shipment: null,
        },
        {
          invoice: orderB,
          items: [
            { name: "Top", sku: "sku-2", unit_price_ghs: 50, quantity: 1 },
            { name: "Skirt", sku: "sku-3", unit_price_ghs: 50, quantity: 1 },
          ],
          shipment: null,
        },
      ],
    });

    const slipA = html.indexOf("PACKING SLIP");
    const shipA = html.indexOf("SHIPPING LABEL");
    const orderA = html.indexOf("OI-TEST0001");
    const orderBPos = html.indexOf("OI-TEST0002");

    assert.ok(slipA >= 0 && shipA > slipA);
    assert.ok(orderA >= 0 && orderBPos > orderA);

    // First shipping label should appear before second order's packing content cluster:
    // Find second PACKING SLIP occurrence
    const secondSlip = html.indexOf("PACKING SLIP", slipA + 1);
    assert.ok(secondSlip > shipA);

    assert.match(html, /ORDER 1 OF 2/);
    assert.match(html, /ORDER 2 OF 2/);
    assert.match(html, /size:\s*100mm\s+150mm/);
    // Product names appear on packing slip only — still present in document
    assert.match(html, /Dress/);
    // Shipping sections must not include payment badge styling content for privacy on ship pages —
    // packing slip still has PAID; ensure shipping class docs exist
    assert.match(html, /class="shipping-label"/);
  });

  it("reports shipping issues per order number", () => {
    const issues = shippingLabelBlockingIssues([
      {
        order_number: "OI-OK",
        phone: "0559591823",
        shipping_address: sampleOrder.shipping_address,
      },
      {
        order_number: "OI-BAD",
        phone: null,
        shipping_address: { first_name: "X" },
      },
    ]);
    assert.equal(issues.length, 1);
    assert.match(issues[0] ?? "", /OI-BAD/);
  });
});
