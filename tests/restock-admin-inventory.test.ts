import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  applySingleVariantStockChange,
  maybeNotifyRestockAfterAdminStockChange,
} from "../lib/restock-notifications/admin-side-effect.ts";
import { shouldTriggerRestockNotification } from "../lib/restock-notifications/transition.ts";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

describe("admin inventory restock side effect", () => {
  it("triggers when all variants 0 → one variant > 0", async () => {
    const before = [
      { id: "a", stock: 0 },
      { id: "b", stock: 0 },
      { id: "c", stock: 0 },
    ];
    const after = applySingleVariantStockChange(before, "b", 3);
    assert.equal(
      shouldTriggerRestockNotification({ beforeVariants: before, afterVariants: after }),
      true
    );

    let notified = 0;
    const result = await maybeNotifyRestockAfterAdminStockChange({
      productId: PRODUCT_ID,
      beforeVariants: before,
      afterVariants: after,
      notify: async () => {
        notified += 1;
      },
    });
    assert.equal(result.shouldNotify, true);
    assert.equal(result.notified, true);
    assert.equal(notified, 1);
  });

  it("triggers when all variants negative/zero → one variant > 0", async () => {
    const before = [
      { id: "a", stock: -2 },
      { id: "b", stock: 0 },
      { id: "c", stock: -1 },
    ];
    const after = applySingleVariantStockChange(before, "a", 1);
    const result = await maybeNotifyRestockAfterAdminStockChange({
      productId: PRODUCT_ID,
      beforeVariants: before,
      afterVariants: after,
      notify: async () => undefined,
    });
    assert.equal(result.shouldNotify, true);
    assert.equal(result.notified, true);
  });

  it("does not trigger when one variant already > 0 and another increases", async () => {
    const before = [
      { id: "a", stock: 2 },
      { id: "b", stock: 0 },
    ];
    const after = applySingleVariantStockChange(before, "b", 5);
    let notified = 0;
    const result = await maybeNotifyRestockAfterAdminStockChange({
      productId: PRODUCT_ID,
      beforeVariants: before,
      afterVariants: after,
      notify: async () => {
        notified += 1;
      },
    });
    assert.equal(result.shouldNotify, false);
    assert.equal(result.notified, false);
    assert.equal(notified, 0);
  });

  it("does not trigger when product remains completely sold out", async () => {
    const before = [
      { id: "a", stock: 0 },
      { id: "b", stock: 0 },
    ];
    const after = applySingleVariantStockChange(before, "a", 0);
    const result = await maybeNotifyRestockAfterAdminStockChange({
      productId: PRODUCT_ID,
      beforeVariants: before,
      afterVariants: after,
      notify: async () => {
        throw new Error("should not run");
      },
    });
    assert.equal(result.shouldNotify, false);
  });

  it("does not trigger when product goes from available → sold out", async () => {
    const before = [
      { id: "a", stock: 4 },
      { id: "b", stock: 0 },
    ];
    const after = applySingleVariantStockChange(before, "a", 0);
    const result = await maybeNotifyRestockAfterAdminStockChange({
      productId: PRODUCT_ID,
      beforeVariants: before,
      afterVariants: after,
      notify: async () => {
        throw new Error("should not run");
      },
    });
    assert.equal(result.shouldNotify, false);
  });

  it("runs one notification cycle when multiple variants restock from zero together", async () => {
    const before = [
      { id: "a", stock: 0 },
      { id: "b", stock: 0 },
      { id: "c", stock: 0 },
    ];
    // Product PUT after-state: several variants now in stock at once.
    const after = [
      { id: "a", stock: 2 },
      { id: "b", stock: 1 },
      { id: "c", stock: 0 },
    ];
    let notified = 0;
    const result = await maybeNotifyRestockAfterAdminStockChange({
      productId: PRODUCT_ID,
      beforeVariants: before,
      afterVariants: after,
      notify: async () => {
        notified += 1;
      },
    });
    assert.equal(result.shouldNotify, true);
    assert.equal(notified, 1);
  });

  it("notification failure does not throw and still reports stock path as successful side-effect", async () => {
    const before = [
      { id: "a", stock: 0 },
      { id: "b", stock: 0 },
    ];
    const after = applySingleVariantStockChange(before, "a", 2);
    const result = await maybeNotifyRestockAfterAdminStockChange({
      productId: PRODUCT_ID,
      beforeVariants: before,
      afterVariants: after,
      notify: async () => {
        throw new Error("Resend down");
      },
    });
    assert.equal(result.shouldNotify, true);
    assert.equal(result.notified, false);
    assert.match(result.error ?? "", /Resend down/);
  });
});

describe("admin product PUT restock reconstruction", () => {
  it("matches inventory path behavior for 0 → available", () => {
    const before = [
      { id: "a", stock: 0 },
      { id: "b", stock: 0 },
    ];
    const afterFromInventory = applySingleVariantStockChange(before, "a", 4);
    const afterFromProductPut = [
      { stock: 4 },
      { stock: 0 },
    ];
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: before,
        afterVariants: afterFromInventory,
      }),
      true
    );
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: before,
        afterVariants: afterFromProductPut,
      }),
      true
    );
  });

  it("does not notify when product PUT increases stock on an already-available product", () => {
    const before = [
      { id: "a", stock: 1 },
      { id: "b", stock: 0 },
    ];
    const after = [
      { stock: 5 },
      { stock: 2 },
    ];
    assert.equal(
      shouldTriggerRestockNotification({ beforeVariants: before, afterVariants: after }),
      false
    );
  });
});

describe("checkout/payment stock deduction isolation", () => {
  it("does not import restock notification modules", () => {
    const root = process.cwd();
    const deduct = readFileSync(join(root, "lib/inventory/deduct-order-stock.ts"), "utf8");
    const markPaid = readFileSync(join(root, "lib/payments/mark-order-paid.ts"), "utf8");
    const checkout = readFileSync(join(root, "app/api/checkout/initialize/route.ts"), "utf8");

    assert.doesNotMatch(deduct, /restock-notifications/);
    assert.doesNotMatch(markPaid, /restock-notifications/);
    assert.doesNotMatch(checkout, /restock-notifications/);
  });

  it("keeps inventory movement reason admin_adjustment in admin inventory route", () => {
    const src = readFileSync(join(process.cwd(), "app/api/admin/inventory/route.ts"), "utf8");
    assert.match(src, /admin_adjustment/);
    assert.match(src, /inventory_movements/);
    assert.match(src, /maybeNotifyRestockAfterAdminStockChange/);
  });

  it("keeps inventory movements in admin products PUT and hooks restock after variant stock writes", () => {
    const src = readFileSync(join(process.cwd(), "app/api/admin/products/route.ts"), "utf8");
    assert.match(src, /admin_adjustment/);
    assert.match(src, /initial_stock/);
    assert.match(src, /maybeNotifyRestockAfterAdminStockChange/);
    // Occasions-only PATCH must not gain stock notify wiring.
    const patchIdx = src.indexOf("export async function PATCH");
    const putIdx = src.indexOf("export async function PUT");
    assert.ok(putIdx >= 0 && patchIdx > putIdx);
    const putBody = src.slice(putIdx, patchIdx);
    const patchBody = src.slice(patchIdx);
    assert.match(putBody, /maybeNotifyRestockAfterAdminStockChange/);
    assert.doesNotMatch(patchBody, /maybeNotifyRestockAfterAdminStockChange/);
  });
});
