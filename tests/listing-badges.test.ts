import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  listingBadgesForStorefrontProduct,
  type StorefrontProduct,
} from "../lib/catalog/storefront-product.ts";

function product(opts: {
  inStockFlags: boolean[];
  badges?: StorefrontProduct["badges"];
}): Pick<StorefrontProduct, "badges" | "variants"> {
  return {
    badges: opts.badges ?? ["best_seller", "trending", "selling_fast"],
    variants: opts.inStockFlags.map((in_stock, i) => ({
      id: `v${i}`,
      sku: `SKU-${i}`,
      price_ghs: 100,
      compare_at_ghs: null,
      size: "M",
      color: "Pink",
      in_stock,
    })),
  };
}

describe("listingBadgesForStorefrontProduct", () => {
  it("hides all promotional tags when every variant is sold out", () => {
    const soldOut = product({
      inStockFlags: [false, false, false],
      badges: ["best_seller", "trending", "selling_fast", "new"],
    });
    assert.deepEqual(listingBadgesForStorefrontProduct(soldOut), []);
    // Underlying badge data is not mutated.
    assert.deepEqual(soldOut.badges, ["best_seller", "trending", "selling_fast", "new"]);
  });

  it("returns empty badges for sold-out products that have no tags", () => {
    const soldOut = product({ inStockFlags: [false], badges: [] });
    assert.deepEqual(listingBadgesForStorefrontProduct(soldOut), []);
  });

  it("keeps existing tags when at least one variant is in stock", () => {
    const available = product({
      inStockFlags: [false, true, false],
      badges: ["best_seller", "trending", "new"],
    });
    assert.deepEqual(listingBadgesForStorefrontProduct(available), [
      "best_seller",
      "trending",
      "new",
    ]);
  });

  it("restores tags for display when stock returns without changing stored badges", () => {
    const row = product({
      inStockFlags: [false, false],
      badges: ["limited", "sale"],
    });
    assert.deepEqual(listingBadgesForStorefrontProduct(row), []);
    row.variants[0]!.in_stock = true;
    assert.deepEqual(listingBadgesForStorefrontProduct(row), ["limited", "sale"]);
    assert.deepEqual(row.badges, ["limited", "sale"]);
  });
});

describe("listing badge wiring", () => {
  it("applies the helper on product cards and listing surfaces, not the PDP", () => {
    const root = process.cwd();
    const card = readFileSync(join(root, "components/store/product-card.tsx"), "utf8");
    const trending = readFileSync(join(root, "components/home/trending-strip.tsx"), "utf8");
    const quick = readFileSync(join(root, "components/shop/quick-view-modal.tsx"), "utf8");
    const pdp = readFileSync(join(root, "app/(store)/product/[slug]/page.tsx"), "utf8");
    const best = readFileSync(join(root, "components/home/best-sellers-row.tsx"), "utf8");

    assert.match(card, /listingBadgesForStorefrontProduct/);
    assert.match(card, /SoldOutBadge/);
    assert.match(trending, /listingBadgesForStorefrontProduct/);
    assert.match(quick, /listingBadgesForStorefrontProduct/);

    // PDP keeps raw product.badges.
    assert.match(pdp, /BadgeSet badges=\{product\.badges\}/);
    assert.doesNotMatch(pdp, /listingBadgesForStorefrontProduct/);

    // Best sellers has no BadgeSet today.
    assert.doesNotMatch(best, /BadgeSet/);
  });
});
