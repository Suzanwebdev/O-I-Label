import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProductAvailableFromStocks,
  shouldTriggerRestockNotification,
} from "../lib/restock-notifications/transition.ts";

function stocks(...values: number[]) {
  return values.map((stock) => ({ stock }));
}

describe("isProductAvailableFromStocks", () => {
  it("is true when any variant stock is > 0", () => {
    assert.equal(isProductAvailableFromStocks(stocks(0, 1, 0)), true);
    assert.equal(isProductAvailableFromStocks(stocks(5, 0, 0)), true);
  });

  it("is false when all stocks are <= 0 or empty", () => {
    assert.equal(isProductAvailableFromStocks(stocks(0, 0, 0)), false);
    assert.equal(isProductAvailableFromStocks(stocks(-1, 0, -3)), false);
    assert.equal(isProductAvailableFromStocks([]), false);
  });
});

describe("shouldTriggerRestockNotification", () => {
  it("returns true when all before <= 0 and after has at least one > 0", () => {
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(0, 0, 0),
        afterVariants: stocks(0, 2, 0),
      }),
      true
    );
  });

  it("returns true for zero → positive on a multi-variant product", () => {
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(0, 0),
        afterVariants: stocks(1, 0),
      }),
      true
    );
  });

  it("returns true for negative → positive (negative counts as unavailable)", () => {
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(-2, -1, 0),
        afterVariants: stocks(-2, 4, 0),
      }),
      true
    );
  });

  it("returns false when before all <= 0 and after still all <= 0", () => {
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(0, 0, 0),
        afterVariants: stocks(0, 0, 0),
      }),
      false
    );
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(0, -1),
        afterVariants: stocks(0, -1),
      }),
      false
    );
  });

  it("returns false for positive → positive (already available)", () => {
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(0, 3, 0),
        afterVariants: stocks(0, 5, 0),
      }),
      false
    );
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(1, 1),
        afterVariants: stocks(2, 0),
      }),
      false
    );
  });

  it("returns false for positive → zero (sell-out, not restock)", () => {
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(0, 2, 0),
        afterVariants: stocks(0, 0, 0),
      }),
      false
    );
  });

  it("returns false for empty before and/or after variants", () => {
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: [],
        afterVariants: stocks(5),
      }),
      false
    );
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: stocks(0, 0),
        afterVariants: [],
      }),
      false
    );
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: [],
        afterVariants: [],
      }),
      false
    );
  });

  it("is product-level: any after-stock > 0 triggers even if other variants stay 0", () => {
    assert.equal(
      shouldTriggerRestockNotification({
        beforeVariants: [
          { stock: 0 },
          { stock: 0 },
          { stock: 0 },
        ],
        afterVariants: [
          { stock: 0 },
          { stock: 0 },
          { stock: 1 },
        ],
      }),
      true
    );
  });
});
