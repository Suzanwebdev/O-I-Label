import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInvoiceHtmlDocument,
  buildOrderInvoiceSection,
  paginateInvoiceItems,
  type OrderInvoiceItem,
  type OrderInvoiceOrder,
} from "../lib/admin/order-invoice.ts";

function item(overrides: Partial<OrderInvoiceItem> = {}): OrderInvoiceItem {
  return {
    name: "Fitted Dress",
    sku: "FD-BLK-S",
    unit_price_ghs: 180,
    quantity: 1,
    ...overrides,
  };
}

const sampleOrder: OrderInvoiceOrder = {
  order_number: "OI-TEST0001",
  email: "guest@example.com",
  phone: "0559591823",
  status: "paid",
  shipping_address: {
    first_name: "Susana",
    last_name: "Ankrah",
    address: "Aviance",
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

describe("paginateInvoiceItems", () => {
  it("keeps a one-item order on a single label", () => {
    const pages = paginateInvoiceItems([item()]);
    assert.equal(pages.length, 1);
    assert.equal(pages[0]?.length, 1);
  });

  it("keeps a few normal items on one label", () => {
    const pages = paginateInvoiceItems([item(), item({ name: "Mesh Top" }), item({ name: "Skirt" })]);
    assert.equal(pages.length, 1);
    assert.equal(pages[0]?.length, 3);
  });

  it("keeps five normal items on one label without SKU lines", () => {
    const pages = paginateInvoiceItems([
      item({ name: "Sleeveless Mesh Mini Fitted Dress" }),
      item({ name: "Sleeveless Lace Patchwork Short Dress" }),
      item({ name: "Striped Multicolored Two-Piece Set" }),
      item({ name: "Silk Halter Neck Top" }),
      item({ name: "Another Dress Style Name" }),
    ]);
    assert.equal(pages.length, 1);
    assert.equal(pages[0]?.length, 5);
  });

  it("splits unusually large orders across labels without orphaning totals-only pages", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      item({
        name: `Very Long Product Name That Will Wrap Across Multiple Lines Item ${i + 1}`,
        sku: `SKU-VERY-LONG-IDENTIFIER-${i + 1}-ABCDEFGHIJKLMNOP`,
      })
    );
    const pages = paginateInvoiceItems(many);
    assert.ok(pages.length > 1);
    assert.ok(pages.every((p) => p.length > 0));
    const totalItems = pages.reduce((n, p) => n + p.length, 0);
    assert.equal(totalItems, 20);
  });
});

describe("buildOrderInvoiceSection", () => {
  it("does not force a blank second page for a single-label order", () => {
    const html = buildOrderInvoiceSection(sampleOrder, [item()], null, { pageBreakAfter: false });
    assert.match(html, /page-break-after:auto/);
    assert.doesNotMatch(html, /page-break-after:always/);
    assert.doesNotMatch(html, /\bPAYMENT\b/);
    assert.doesNotMatch(html, /\bPAID\b/);
    assert.doesNotMatch(html, /pay-badge/);
    assert.match(html, /FREE/);
    assert.match(html, /PACKING SLIP/);
  });

  it("marks continuation between labels of a large order", () => {
    const many = Array.from({ length: 18 }, (_, i) =>
      item({ name: `Long Wrap Name Product Number ${i} Extra Words Here` })
    );
    const html = buildOrderInvoiceSection(sampleOrder, many, null, { pageBreakAfter: false });
    assert.match(html, /LABEL 1 OF/);
    assert.match(html, /Continued on next label/);
    assert.match(html, /page-break-after:always/);
    // Final label should not break after when pageBreakAfter is false
    const labels = html.match(/class="thermal-label"/g) ?? [];
    assert.ok(labels.length > 1);
    assert.match(html, /page-break-after:auto/);
  });

  it("never prints SKU on the packing slip", () => {
    const html = buildOrderInvoiceSection(
      sampleOrder,
      [item({ sku: "sleeveless-mesh-mini-fitted-dress-black-s", name: "Sleeveless Mesh Mini Fitted Dress" })],
      null,
      { pageBreakAfter: false }
    );
    assert.doesNotMatch(html, /SKU/i);
    assert.doesNotMatch(html, /sleeveless-mesh-mini-fitted-dress-black-s/);
    assert.match(html, /Sleeveless Mesh Mini Fitted Dress/);
    assert.match(html, /×1/);
    assert.match(html, /Thank you for choosing O &amp; I Label/);
  });

  it("prints variant line only when color/size already exist on the item", () => {
    const withVariant = buildOrderInvoiceSection(
      sampleOrder,
      [item({ color: "Black", size: "S", name: "Mesh Dress" })],
      null,
      { pageBreakAfter: false }
    );
    assert.match(withVariant, /Black · S/);
    assert.doesNotMatch(withVariant, /SKU/i);

    const without = buildOrderInvoiceSection(
      sampleOrder,
      [item({ name: "Mesh Dress", sku: "mesh-dress-black-s" })],
      null,
      { pageBreakAfter: false }
    );
    assert.doesNotMatch(without, /Black/);
    assert.doesNotMatch(without, /mesh-dress-black-s/);
  });

  it("keeps separate lines for same product with different sizes", () => {
    const html = buildOrderInvoiceSection(
      sampleOrder,
      [
        item({ name: "Sleeveless Mesh Mini Fitted Dress", color: "Black", size: "S", quantity: 1 }),
        item({ name: "Sleeveless Mesh Mini Fitted Dress", color: "Black", size: "M", quantity: 1 }),
      ],
      null,
      { pageBreakAfter: false }
    );
    assert.match(html, /Black · S/);
    assert.match(html, /Black · M/);
    assert.equal((html.match(/Sleeveless Mesh Mini Fitted Dress/g) ?? []).length, 2);
  });

  it("keeps five items with variants on one label when content allows", () => {
    const pages = paginateInvoiceItems([
      item({ name: "Dress One", color: "Black", size: "S" }),
      item({ name: "Dress Two", color: "Black", size: "M" }),
      item({ name: "Dress Three", color: "Black", size: "L" }),
      item({ name: "Dress Four", color: "Red", size: "M" }),
      item({ name: "Two-Piece Set", color: "Multicolor", size: "M" }),
    ]);
    assert.equal(pages.length, 1);
  });

  it("omits empty email lines", () => {
    const html = buildOrderInvoiceSection(
      { ...sampleOrder, email: "" },
      [item({ sku: null, name: "No Sku Dress" })],
      null,
      { pageBreakAfter: false }
    );
    assert.doesNotMatch(html, /undefined/);
    assert.doesNotMatch(html, />Email</i);
  });
});

describe("buildInvoiceHtmlDocument", () => {
  it("declares 100mm × 150mm @page size", () => {
    const html = buildInvoiceHtmlDocument({
      title: "Packing slip",
      sections: ['<section class="thermal-label" style="page-break-after:auto;"></section>'],
      autoPrint: false,
    });
    assert.match(html, /@page\s*\{\s*size:\s*100mm\s+150mm;/);
  });

  it("places thank-you footer low with flex auto margin, not the totals block", () => {
    const html = buildInvoiceHtmlDocument({
      title: "Packing slip",
      sections: [
        buildOrderInvoiceSection(sampleOrder, [item()], null, { pageBreakAfter: false }),
      ],
      autoPrint: false,
    });
    assert.match(html, /\.label-footer\s*\{[^}]*margin-top:\s*auto;/);
    assert.doesNotMatch(html, /\.summary\s*\{[^}]*margin-top:\s*auto;/);
    assert.match(html, /Thank you for choosing O &amp; I Label/);
    assert.match(html, /TOTAL/);
    // Footer follows totals in markup; single-label orders must not force a break after.
    const thankIdx = html.indexOf("Thank you for choosing");
    const totalIdx = html.indexOf("TOTAL");
    assert.ok(totalIdx >= 0 && thankIdx > totalIdx);
    assert.doesNotMatch(html, /page-break-after:always/);
  });
});
