import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareProductSizes,
  sortProductSizes,
} from "../lib/catalog/product-size-order.ts";
import { collectProductSizes } from "../lib/restock-notifications/ui.ts";
import type { StorefrontProduct } from "../lib/catalog/storefront-product.ts";

describe("sortProductSizes", () => {
  it("orders letter sizes from S toward the largest available", () => {
    assert.deepEqual(sortProductSizes(["XL", "S", "L", "M", "2XL"]), [
      "S",
      "M",
      "L",
      "XL",
      "2XL",
    ]);
  });

  it("orders numeric sizes ascending from 6 upward", () => {
    assert.deepEqual(sortProductSizes(["14", "6", "10", "8", "12"]), [
      "6",
      "8",
      "10",
      "12",
      "14",
    ]);
  });

  it("includes XS before S when present", () => {
    assert.deepEqual(sortProductSizes(["M", "XS", "S"]), ["XS", "S", "M"]);
  });

  it("dedupes and ignores blank values", () => {
    assert.deepEqual(sortProductSizes(["M", "S", "M", "", null, "  L  "]), [
      "S",
      "M",
      "L",
    ]);
  });

  it("is stable for compareProductSizes letter vs number groups", () => {
    assert.ok(compareProductSizes("S", "M") < 0);
    assert.ok(compareProductSizes("6", "10") < 0);
    assert.ok(compareProductSizes("L", "6") < 0);
  });
});

describe("collectProductSizes uses ordered sizes", () => {
  it("returns sizes in ascending order for Notify Me dialogs", () => {
    const product = {
      variants: [
        { size: "L", color: "Pink", in_stock: false },
        { size: "S", color: "Pink", in_stock: false },
        { size: "XL", color: "Black", in_stock: false },
      ],
    } as Pick<StorefrontProduct, "variants">;
    assert.deepEqual(collectProductSizes(product), ["S", "L", "XL"]);
  });
});
