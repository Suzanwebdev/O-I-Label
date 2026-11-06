import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findInactiveProducts } from "../lib/checkout/active-products.ts";

function fakeService(rows: { id: string; is_active: boolean }[] | null, error: { message: string } | null = null) {
  const calls: { table: string; select: string; ids: string[] }[] = [];
  const client = {
    from(table: string) {
      return {
        select(select: string) {
          return {
            async in(_column: string, ids: string[]) {
              calls.push({ table, select, ids });
              return { data: rows ? rows.filter((r) => ids.includes(r.id)) : null, error };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("findInactiveProducts", () => {
  it("reports unpublished products", async () => {
    const { client, calls } = fakeService([
      { id: "p1", is_active: true },
      { id: "p2", is_active: false },
    ]);
    const result = await findInactiveProducts(client, ["p1", "p2", "p1"]);
    assert.deepEqual(result, { ok: true, inactiveProductIds: ["p2"] });
    assert.deepEqual(calls, [{ table: "products", select: "id, is_active", ids: ["p1", "p2"] }]);
  });

  it("treats products missing from the database as inactive", async () => {
    const { client } = fakeService([{ id: "p1", is_active: true }]);
    assert.deepEqual(await findInactiveProducts(client, ["p1", "gone"]), {
      ok: true,
      inactiveProductIds: ["gone"],
    });
  });

  it("allows checkout when every product is active", async () => {
    const { client } = fakeService([{ id: "p1", is_active: true }]);
    assert.deepEqual(await findInactiveProducts(client, ["p1"]), { ok: true, inactiveProductIds: [] });
  });

  it("fails closed when the publication check cannot be read", async () => {
    const { client } = fakeService(null, { message: "db unavailable" });
    assert.deepEqual(await findInactiveProducts(client, ["p1"]), { ok: false, error: "db unavailable" });
  });
});

describe("checkout initialization wiring", () => {
  const checkout = readFileSync("app/api/checkout/initialize/route.ts", "utf8");

  it("rejects inactive products before any order or payment is created", () => {
    const variantsAt = checkout.indexOf('.select("id, product_id, sku, price_ghs, stock")');
    const activityAt = checkout.indexOf("findInactiveProducts(");
    const stockAt = checkout.indexOf("findInsufficientStock(");
    const orderAt = checkout.indexOf('.from("orders")');
    const paymentAt = checkout.indexOf("initiatePayment(");
    assert.ok(variantsAt > 0 && activityAt > variantsAt, "check runs after authoritative variant load");
    assert.ok(activityAt < stockAt && activityAt < orderAt && activityAt < paymentAt);
    assert.match(
      checkout,
      /inactiveProductIds\.length\) \{\s*return NextResponse\.json\(\{ error: "One or more selected items are no longer available" \}, \{ status: 409 \}\);/
    );
  });

  it("still prices and stock-checks from the database", () => {
    assert.match(checkout, /\.from\("variants"\)\s*\.select\("id, product_id, sku, price_ghs, stock"\)/);
    assert.match(checkout, /findInsufficientStock\(/);
    assert.match(checkout, /Number\(v\.price_ghs\) \* line\.quantity/);
  });

  it("does not touch existing orders or pending payment confirmation paths", () => {
    const paymentPaths = [
      "app/api/webhooks/moolre/route.ts",
      "app/api/checkout/payment-status/route.ts",
      "app/api/cron/reconcile-payments/route.ts",
      "app/api/admin/orders/[orderId]/confirm-payment/route.ts",
      "lib/payments/reconcile-payment.ts",
      "lib/payments/mark-order-paid.ts",
      "lib/payments/handle-webhook.ts",
      "lib/inventory/deduct-order-stock.ts",
    ];
    for (const file of paymentPaths) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /findInactiveProducts|active-products|is_active/, file);
    }
  });
});
