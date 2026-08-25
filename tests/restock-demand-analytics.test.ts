import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  aggregateRestockDemand,
  buildRestockDemandOverview,
  filterRestockDemandOverview,
  preferenceDisplayValue,
  preferenceLabel,
  type RestockDemandMultiProductRow,
  type RestockDemandPreferenceRow,
} from "../lib/restock-notifications/demand-analytics.ts";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const PRODUCT_C = "33333333-3333-4333-8333-333333333333";

function row(
  partial: Partial<RestockDemandPreferenceRow> & Pick<RestockDemandPreferenceRow, "status">
): RestockDemandPreferenceRow {
  return {
    preferred_color: partial.preferred_color ?? null,
    preferred_size: partial.preferred_size ?? null,
    status: partial.status,
  };
}

describe("preferenceDisplayValue / preferenceLabel", () => {
  it("maps NULL and blank to Any", () => {
    assert.equal(preferenceDisplayValue(null), null);
    assert.equal(preferenceDisplayValue(""), null);
    assert.equal(preferenceDisplayValue("  "), null);
    assert.equal(preferenceDisplayValue("any"), null);
    assert.equal(preferenceDisplayValue("Any"), null);
    assert.equal(preferenceLabel(null), "Any");
    assert.equal(preferenceLabel("M"), "M");
  });
});

describe("aggregateRestockDemand", () => {
  it("returns zero active demand when there are no subscriptions", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, []);
    assert.equal(summary.productId, PRODUCT_ID);
    assert.equal(summary.active.total, 0);
    assert.deepEqual(summary.active.sizes, []);
    assert.deepEqual(summary.active.colors, []);
    assert.deepEqual(summary.active.combinations, []);
    assert.deepEqual(summary.historical, { notified: 0, unsubscribedOrCancelled: 0 });
  });

  it("aggregates multiple active subscriptions by size and colour", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
      row({ status: "active", preferred_color: "Pink", preferred_size: "L" }),
      row({ status: "active", preferred_color: "Black", preferred_size: "M" }),
      row({ status: "active", preferred_color: null, preferred_size: "S" }),
      row({ status: "active", preferred_color: "White", preferred_size: null }),
      row({ status: "active", preferred_color: null, preferred_size: null }),
    ]);

    assert.equal(summary.active.total, 7);

    assert.deepEqual(
      summary.active.sizes.map((s) => [s.label, s.count]),
      [
        ["M", 3],
        ["Any", 2],
        ["L", 1],
        ["S", 1],
      ]
    );
    assert.deepEqual(
      summary.active.colors.map((c) => [c.label, c.count]),
      [
        ["Pink", 3],
        ["Any", 2],
        ["Black", 1],
        ["White", 1],
      ]
    );
  });

  it("treats NULL size as Any", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "active", preferred_color: "Pink", preferred_size: null }),
      row({ status: "active", preferred_color: "Pink", preferred_size: "" }),
    ]);
    assert.equal(summary.active.total, 2);
    assert.equal(summary.active.sizes[0]?.label, "Any");
    assert.equal(summary.active.sizes[0]?.count, 2);
    assert.equal(summary.active.sizes[0]?.value, null);
  });

  it("treats NULL colour as Any", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "active", preferred_color: null, preferred_size: "M" }),
    ]);
    assert.equal(summary.active.colors[0]?.label, "Any");
    assert.equal(summary.active.colors[0]?.value, null);
  });

  it("aggregates the same size/colour combination", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
    ]);
    assert.equal(summary.active.combinations.length, 1);
    assert.equal(summary.active.combinations[0]?.colorLabel, "Pink");
    assert.equal(summary.active.combinations[0]?.sizeLabel, "M");
    assert.equal(summary.active.combinations[0]?.count, 3);
  });

  it("keeps different preferences separate", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
      row({ status: "active", preferred_color: "Pink", preferred_size: "L" }),
      row({ status: "active", preferred_color: "Black", preferred_size: "M" }),
      row({ status: "active", preferred_color: null, preferred_size: "M" }),
    ]);
    assert.equal(summary.active.combinations.length, 4);
    assert.deepEqual(
      summary.active.combinations.map((c) => `${c.colorLabel}/${c.sizeLabel}:${c.count}`),
      ["Any/M:1", "Black/M:1", "Pink/L:1", "Pink/M:1"]
    );
  });

  it("excludes notified subscriptions from current waiting", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
      row({ status: "notified", preferred_color: "Pink", preferred_size: "M" }),
      row({ status: "notified", preferred_color: "Black", preferred_size: "L" }),
    ]);
    assert.equal(summary.active.total, 1);
    assert.equal(summary.historical.notified, 2);
    assert.equal(summary.active.sizes.find((s) => s.label === "M")?.count, 1);
    assert.equal(summary.active.colors.find((c) => c.label === "Black"), undefined);
  });

  it("excludes unsubscribed subscriptions from current waiting", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
      row({ status: "unsubscribed", preferred_color: "Pink", preferred_size: "L" }),
    ]);
    assert.equal(summary.active.total, 1);
    assert.equal(summary.historical.unsubscribedOrCancelled, 1);
    assert.equal(summary.active.sizes.find((s) => s.label === "L"), undefined);
  });

  it("excludes cancelled subscriptions from current waiting", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "cancelled", preferred_color: "White", preferred_size: "S" }),
      row({ status: "active", preferred_color: "Black", preferred_size: "M" }),
    ]);
    assert.equal(summary.active.total, 1);
    assert.equal(summary.historical.unsubscribedOrCancelled, 1);
    assert.equal(summary.active.colors[0]?.label, "Black");
  });

  it("does not include email fields in the aggregate summary", () => {
    const summary = aggregateRestockDemand(PRODUCT_ID, [
      row({ status: "active", preferred_color: "Pink", preferred_size: "M" }),
    ]);
    const json = JSON.stringify(summary);
    assert.doesNotMatch(json, /email/i);
    assert.equal("email" in summary, false);
    assert.equal("email_normalized" in (summary as object), false);
  });
});

function multi(
  productId: string,
  partial: Partial<RestockDemandPreferenceRow> & Pick<RestockDemandPreferenceRow, "status">
): RestockDemandMultiProductRow {
  return { product_id: productId, ...row(partial) };
}

describe("buildRestockDemandOverview", () => {
  it("includes products with active subscriptions", () => {
    const overview = buildRestockDemandOverview([
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "M" }),
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "L" }),
    ]);
    assert.equal(overview.length, 1);
    assert.equal(overview[0]?.productId, PRODUCT_ID);
    assert.equal(overview[0]?.waiting, 2);
  });

  it("omits products with no active subscriptions", () => {
    const overview = buildRestockDemandOverview([
      multi(PRODUCT_ID, { status: "notified", preferred_color: "Pink", preferred_size: "M" }),
      multi(PRODUCT_B, { status: "unsubscribed", preferred_color: "Black", preferred_size: "S" }),
      multi(PRODUCT_C, { status: "cancelled", preferred_color: null, preferred_size: null }),
    ]);
    assert.deepEqual(overview, []);
  });

  it("sorts products by active waiting count descending", () => {
    const overview = buildRestockDemandOverview([
      multi(PRODUCT_B, { status: "active", preferred_color: "Black", preferred_size: "M" }),
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "M" }),
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "L" }),
      multi(PRODUCT_ID, { status: "active", preferred_color: "White", preferred_size: "S" }),
      multi(PRODUCT_C, { status: "active", preferred_color: null, preferred_size: "M" }),
      multi(PRODUCT_C, { status: "active", preferred_color: null, preferred_size: "L" }),
    ]);
    assert.deepEqual(
      overview.map((o) => [o.productId, o.waiting]),
      [
        [PRODUCT_ID, 3],
        [PRODUCT_C, 2],
        [PRODUCT_B, 1],
      ]
    );
  });

  it("exposes correct top size, colour, and combination", () => {
    const overview = buildRestockDemandOverview([
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "M" }),
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "M" }),
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "L" }),
      multi(PRODUCT_ID, { status: "active", preferred_color: "Black", preferred_size: "M" }),
      multi(PRODUCT_ID, { status: "notified", preferred_color: "White", preferred_size: "XL" }),
    ]);
    const item = overview[0];
    assert.ok(item);
    assert.equal(item.waiting, 4);
    assert.equal(item.topSize?.label, "M");
    assert.equal(item.topSize?.count, 3);
    assert.equal(item.topColor?.label, "Pink");
    assert.equal(item.topColor?.count, 3);
    assert.equal(item.topCombination?.colorLabel, "Pink");
    assert.equal(item.topCombination?.sizeLabel, "M");
    assert.equal(item.topCombination?.count, 2);
    assert.equal(item.demand.historical.notified, 1);
  });

  it("does not count notified or unsubscribed toward overview ranking", () => {
    const overview = buildRestockDemandOverview([
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "M" }),
      multi(PRODUCT_ID, { status: "notified", preferred_color: "Pink", preferred_size: "M" }),
      multi(PRODUCT_ID, { status: "unsubscribed", preferred_color: "Pink", preferred_size: "M" }),
      multi(PRODUCT_B, {
        status: "notified",
        preferred_color: "Black",
        preferred_size: "L",
      }),
      multi(PRODUCT_B, {
        status: "notified",
        preferred_color: "Black",
        preferred_size: "L",
      }),
      multi(PRODUCT_B, {
        status: "notified",
        preferred_color: "Black",
        preferred_size: "L",
      }),
    ]);
    assert.equal(overview.length, 1);
    assert.equal(overview[0]?.productId, PRODUCT_ID);
    assert.equal(overview[0]?.waiting, 1);
  });

  it("does not include email fields in overview items", () => {
    const overview = buildRestockDemandOverview([
      multi(PRODUCT_ID, { status: "active", preferred_color: "Pink", preferred_size: "M" }),
    ]);
    assert.doesNotMatch(JSON.stringify(overview), /email/i);
  });
});

describe("filterRestockDemandOverview", () => {
  const items = [
    {
      productName: "Silk Midi Dress",
      productSlug: "silk-midi",
      categoryName: "Dresses",
      waiting: 10,
    },
    {
      productName: "Linen Shirt",
      productSlug: "linen-shirt",
      categoryName: "Tops",
      waiting: 4,
    },
  ];

  it("filters by product name search", () => {
    const hit = filterRestockDemandOverview(items, "silk");
    assert.equal(hit.length, 1);
    assert.equal(hit[0]?.productName, "Silk Midi Dress");
  });

  it("filters by category", () => {
    const hit = filterRestockDemandOverview(items, "", "Tops");
    assert.equal(hit.length, 1);
    assert.equal(hit[0]?.productName, "Linen Shirt");
  });
});

describe("admin restock demand API security", () => {
  it("requires admin authorization and never selects email columns", () => {
    const root = process.cwd();
    const route = readFileSync(join(root, "app/api/admin/restock-notifications/route.ts"), "utf8");
    const store = readFileSync(join(root, "lib/restock-notifications/demand-store.ts"), "utf8");

    assert.match(route, /getRequestAuthz/);
    assert.match(route, /authz\.isAdmin/);
    assert.match(route, /status: 401/);
    assert.match(route, /status: 403/);
    assert.match(route, /getRestockDemandSummaryForProduct/);
    assert.match(route, /getRestockDemandOverview/);

    assert.match(store, /preferred_color, preferred_size, status/);
    assert.match(store, /product_id, preferred_color, preferred_size, status/);
    assert.doesNotMatch(store, /email_normalized|email_raw|unsubscribe_token/);
    assert.doesNotMatch(route, /email_normalized|email_raw/);
  });

  it("loads overview with a bounded number of server queries (not one per product)", () => {
    const store = readFileSync(
      join(process.cwd(), "lib/restock-notifications/demand-store.ts"),
      "utf8"
    );
    assert.match(store, /getRestockDemandOverview/);
    assert.match(store, /loadRestockDemandOverviewRows/);
    assert.match(store, /\.in\("id", productIds\)/);
    // Must not loop with per-product preference queries in overview.
    assert.doesNotMatch(store, /for \(const .+ of overview[\s\S]*loadRestockDemandPreferenceRows/);
  });

  it("does not wire demand analytics into storefront or purchase paths", () => {
    const root = process.cwd();
    const pdp = readFileSync(join(root, "components/product/product-variant-form.tsx"), "utf8");
    const checkout = readFileSync(join(root, "app/api/checkout/initialize/route.ts"), "utf8");
    const deduct = readFileSync(join(root, "lib/inventory/deduct-order-stock.ts"), "utf8");
    const notify = readFileSync(join(root, "lib/restock-notifications/notify.ts"), "utf8");
    const send = readFileSync(join(root, "lib/restock-notifications/send.ts"), "utf8");

    assert.doesNotMatch(pdp, /demand-analytics|demand-store|RestockDemandPanel/);
    assert.doesNotMatch(checkout, /demand-analytics|demand-store/);
    assert.doesNotMatch(deduct, /demand-analytics|demand-store/);
    assert.doesNotMatch(notify, /demand-analytics|demand-store/);
    assert.doesNotMatch(send, /demand-analytics|demand-store/);
  });

  it("keeps product-edit demand panel and adds overview page + nav", () => {
    const root = process.cwd();
    const page = readFileSync(join(root, "app/admin/products/[productId]/page.tsx"), "utf8");
    const overview = readFileSync(join(root, "app/admin/restock-demand/page.tsx"), "utf8");
    const sidebar = readFileSync(join(root, "components/admin/admin-sidebar.tsx"), "utf8");

    assert.match(page, /RestockDemandPanel/);
    assert.match(page, /getRestockDemandSummaryForProduct/);
    assert.match(overview, /getRestockDemandOverview/);
    assert.match(overview, /RestockDemandOverview/);
    assert.match(sidebar, /\/admin\/restock-demand/);
    assert.match(sidebar, /Restock Demand/);
  });
});
