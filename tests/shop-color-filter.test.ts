import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHOP_FILTER_COLORS,
  variantMatchesShopColorFilter,
} from "../lib/shop-color-filter.ts";

describe("shop colour filter list", () => {
  it("uses the basic colour set in the requested order", () => {
    assert.deepEqual([...SHOP_FILTER_COLORS], [
      "Black",
      "White",
      "Ivory",
      "Pink",
      "Red",
      "Blue",
      "Green",
      "Brown",
      "Purple",
      "Yellow",
      "Orange",
      "Navy",
      "Grey",
    ]);
  });
});

describe("shop colour family matching", () => {
  it("matches pink variants regardless of extra words or capitalisation", () => {
    assert.equal(variantMatchesShopColorFilter("Pink", "Pink"), true);
    assert.equal(variantMatchesShopColorFilter("pink", "Pink"), true);
    assert.equal(variantMatchesShopColorFilter("HOT PINK", "Pink"), true);
    assert.equal(variantMatchesShopColorFilter("Light Pink", "Pink"), true);
    assert.equal(variantMatchesShopColorFilter("Dusty-rose", "Pink"), true);
    assert.equal(variantMatchesShopColorFilter("Red", "Pink"), false);
  });

  it("keeps navy on Navy, not Blue", () => {
    assert.equal(variantMatchesShopColorFilter("Navy", "Navy"), true);
    assert.equal(variantMatchesShopColorFilter("Navy Blue", "Navy"), true);
    assert.equal(variantMatchesShopColorFilter("Midnight", "Navy"), true);
    assert.equal(variantMatchesShopColorFilter("Navy Blue", "Blue"), false);
    assert.equal(variantMatchesShopColorFilter("Sky Blue", "Blue"), true);
  });

  it("matches grey/gray spellings and charcoal", () => {
    assert.equal(variantMatchesShopColorFilter("Grey", "Grey"), true);
    assert.equal(variantMatchesShopColorFilter("Gray", "Grey"), true);
    assert.equal(variantMatchesShopColorFilter("Charcoal", "Grey"), true);
  });

  it("maps fashion browns like espresso onto Brown", () => {
    assert.equal(variantMatchesShopColorFilter("Espresso", "Brown"), true);
    assert.equal(variantMatchesShopColorFilter("Ivory", "Brown"), false);
  });
});
