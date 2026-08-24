import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeProductCategoryIds,
  parseExtraCategoryIds,
  productBelongsToCategorySlug,
} from "../lib/catalog/product-categories.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("product category ids", () => {
  it("merges primary and extras without duplicates", () => {
    assert.deepEqual(mergeProductCategoryIds(A, [B, A, C, B]), [A, B, C]);
  });

  it("parses only valid uuid extras", () => {
    assert.deepEqual(parseExtraCategoryIds([B, "not-a-uuid", B, 3, C]), [B, C]);
    assert.deepEqual(parseExtraCategoryIds(null), []);
  });

  it("matches products that list the category slug among extras", () => {
    assert.equal(
      productBelongsToCategorySlug(
        { category_slug: "tops", category_slugs: ["tops", "denim"] },
        "denim"
      ),
      true
    );
    assert.equal(
      productBelongsToCategorySlug({ category_slug: "tops", category_slugs: ["tops"] }, "denim"),
      false
    );
    assert.equal(productBelongsToCategorySlug({ category_slug: "tops" }, "tops"), true);
  });
});
