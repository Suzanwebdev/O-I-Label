import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  aggregateRestockDemand,
  preferenceDisplayValue,
  preferenceLabel,
  type RestockDemandPreferenceRow,
} from "../lib/restock-notifications/demand-analytics.ts";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

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

    assert.match(store, /preferred_color, preferred_size, status/);
    assert.doesNotMatch(store, /email_normalized|email_raw|unsubscribe_token/);
    assert.doesNotMatch(route, /email_normalized|email_raw/);
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

  it("surfaces demand on the admin product edit page only", () => {
    const page = readFileSync(
      join(process.cwd(), "app/admin/products/[productId]/page.tsx"),
      "utf8"
    );
    assert.match(page, /RestockDemandPanel/);
    assert.match(page, /getRestockDemandSummaryForProduct/);
  });
});
