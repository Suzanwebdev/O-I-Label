import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyHomepageProductOrder,
  parseBestSellersProductOrder,
} from "@/lib/home/homepage-product-order";
import { buildDefaultHomeBestSellersList, buildHomeBestSellersList } from "@/lib/shop-utils";
import type { Product } from "@/lib/types";

function product(partial: Pick<Product, "id" | "slug" | "name" | "badges">): Product {
  return {
    id: partial.id,
    slug: partial.slug,
    name: partial.name,
    description: "",
    category_slug: "tops",
    category_name: "Tops",
    category_slugs: ["tops"],
    badges: partial.badges,
    images: ["/file.svg"],
    is_active: true,
    variants: [
      {
        id: `${partial.id}-v`,
        sku: `${partial.slug}-sku`,
        price_ghs: 100,
        stock: 3,
      },
    ],
  };
}

describe("homepage product order", () => {
  it("parses unique non-empty string ids from sections", () => {
    assert.deepEqual(
      parseBestSellersProductOrder({
        best_sellers_product_order: [" a ", "b", "a", "", 3, null, "c"],
      }),
      ["a", "b", "c"]
    );
    assert.deepEqual(parseBestSellersProductOrder({}), []);
    assert.deepEqual(parseBestSellersProductOrder(null), []);
  });

  it("applies saved order and appends unknown products from fallback", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const c = { id: "c" };
    assert.deepEqual(applyHomepageProductOrder([a, b, c], ["c", "a"], [a, b, c]), [c, a, b]);
    assert.deepEqual(applyHomepageProductOrder([a, b, c], [], [b, a, c]), [b, a, c]);
  });

  it("buildHomeBestSellersList respects manual order over badge ranking", () => {
    const tagged = product({
      id: "tagged",
      slug: "tagged",
      name: "Tagged",
      badges: ["best_seller"],
    });
    const other = product({
      id: "other",
      slug: "other",
      name: "Other",
      badges: [],
    });
    const newest = product({
      id: "newest",
      slug: "newest",
      name: "Newest",
      badges: [],
    });

    const auto = buildDefaultHomeBestSellersList([other, tagged, newest]);
    assert.equal(auto[0]?.id, "tagged");

    const manual = buildHomeBestSellersList([other, tagged, newest], ["newest", "other", "tagged"]);
    assert.deepEqual(
      manual.map((p) => p.id),
      ["newest", "other", "tagged"]
    );
  });

  it("appends newly uploaded products after a saved order", () => {
    const a = product({ id: "a", slug: "a", name: "A", badges: [] });
    const b = product({ id: "b", slug: "b", name: "B", badges: ["best_seller"] });
    const c = product({ id: "c", slug: "c", name: "C", badges: [] });

    const list = buildHomeBestSellersList([a, b, c], ["a"]);
    assert.deepEqual(
      list.map((p) => p.id),
      ["a", "b", "c"]
    );
  });
});
