import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPackingSlipVariantLine,
  pickOrderItemVariantAttrs,
} from "../lib/admin/order-item-variant.ts";

describe("order item variant attrs", () => {
  it("reads color and size from a joined variants object", () => {
    assert.deepEqual(pickOrderItemVariantAttrs({ color: "Black", size: "M" }), {
      color: "Black",
      size: "M",
    });
  });

  it("formats Black · S without SKU wording", () => {
    assert.equal(formatPackingSlipVariantLine({ color: "Black", size: "S" }), "Black · S");
    assert.equal(formatPackingSlipVariantLine({ color: "Multicolor", size: "M" }), "Multicolor · M");
    assert.equal(formatPackingSlipVariantLine({ color: "Black" }), "Black");
    assert.equal(formatPackingSlipVariantLine({ size: "L" }), "L");
    assert.equal(formatPackingSlipVariantLine({}), null);
  });
});
