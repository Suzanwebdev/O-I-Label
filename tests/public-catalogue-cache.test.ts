import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { applyLiveAvailability } from "../lib/catalog/variant-stock.ts";
import {
  PUBLIC_CACHE_TAGS,
  publicCacheKeyParts,
  withPublicCacheExpiry,
  type PublicCacheTag,
} from "../lib/cache/public-catalogue.ts";
import type { Product } from "../lib/types.ts";

function product(id: string, variants: Array<{ id: string; stock: number }>): Product {
  return {
    id,
    slug: id,
    name: id,
    description: "",
    seo_title: null,
    seo_description: null,
    category_slug: "dresses",
    category_name: "Dresses",
    category_slugs: ["dresses"],
    images: ["/file.svg"],
    badges: [],
    occasions: [],
    variants: variants.map((v) => ({ id: v.id, sku: `${v.id}-sku`, price_ghs: 100, stock: v.stock })),
    is_active: true,
  } as Product;
}

describe("applyLiveAvailability", () => {
  it("replaces cached stock with live stock per variant", () => {
    const cached = [product("p1", [{ id: "v1", stock: 5 }, { id: "v2", stock: 3 }])];
    const live = new Map([["p1", new Map([["v1", 0], ["v2", 7]])]]);
    const result = applyLiveAvailability(cached, live);
    assert.deepEqual(
      result[0]?.variants.map((v) => v.stock),
      [0, 7]
    );
    assert.equal(cached[0]?.variants[0]?.stock, 5, "cached input is not mutated");
  });

  it("drops products that are no longer publicly visible", () => {
    const cached = [product("p1", [{ id: "v1", stock: 5 }]), product("p2", [{ id: "v2", stock: 5 }])];
    const result = applyLiveAvailability(cached, new Map([["p2", new Map([["v2", 4]])]]));
    assert.deepEqual(
      result.map((p) => p.id),
      ["p2"]
    );
  });

  it("drops variants missing from the live read instead of keeping cached stock", () => {
    const cached = [product("p1", [{ id: "v1", stock: 5 }, { id: "v2", stock: 3 }])];
    const result = applyLiveAvailability(cached, new Map([["p1", new Map([["v1", 1]])]]));
    assert.deepEqual(
      result[0]?.variants.map((v) => [v.id, v.stock]),
      [["v1", 1]]
    );
  });

  it("preserves product order and non-stock fields", () => {
    const cached = [product("b", [{ id: "vb", stock: 1 }]), product("a", [{ id: "va", stock: 1 }])];
    const live = new Map([
      ["a", new Map([["va", 9]])],
      ["b", new Map([["vb", 2]])],
    ]);
    const result = applyLiveAvailability(cached, live);
    assert.deepEqual(
      result.map((p) => p.id),
      ["b", "a"]
    );
    assert.equal(result[1]?.variants[0]?.price_ghs, 100);
    assert.equal(result[1]?.variants[0]?.sku, "va-sku");
  });
});

describe("withPublicCacheExpiry", () => {
  function setup(status: number) {
    const expired: Array<readonly PublicCacheTag[]> = [];
    const handler = withPublicCacheExpiry(
      async () => new Response(null, { status }),
      [PUBLIC_CACHE_TAGS.products],
      (tags) => {
        expired.push(tags);
      }
    );
    return { handler, expired };
  }

  for (const status of [200, 201, 400, 409, 500]) {
    it(`expires tags after an authorised admin request (${status})`, async () => {
      const { handler, expired } = setup(status);
      const res = await handler(new Request("http://localhost/api/admin/products"));
      assert.equal(res.status, status);
      assert.deepEqual(expired, [[PUBLIC_CACHE_TAGS.products]]);
    });
  }

  for (const status of [401, 403]) {
    it(`does not expire tags for unauthorised callers (${status})`, async () => {
      const { handler, expired } = setup(status);
      const res = await handler(new Request("http://localhost/api/admin/products"));
      assert.equal(res.status, status);
      assert.equal(expired.length, 0);
    });
  }
});

describe("public cache key scoping", () => {
  it("includes the Supabase project URL so other databases never share entries", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";
    try {
      assert.ok(publicCacheKeyParts("active-products").includes("https://example-project.supabase.co"));
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });
});

describe("public catalogue caching source contracts", () => {
  const catalog = readFileSync("lib/data/catalog.ts", "utf8");
  const homeContent = readFileSync("lib/data/home-content.ts", "utf8");
  const publicClient = readFileSync("lib/supabase/public.ts", "utf8");

  it("cached public reads never use the cookie-bound or service-role clients", () => {
    for (const source of [catalog, homeContent]) {
      assert.doesNotMatch(source, /createServerSupabaseClient|createServiceRoleClient|next\/headers|cookies\(/);
      assert.match(source, /createPublicSupabaseClient/);
      assert.match(source, /unstable_cache/);
    }
    assert.doesNotMatch(publicClient, /SERVICE_ROLE/);
    assert.match(publicClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(publicClient, /persistSession: false/);
  });

  it("caches products, categories and home content under their own tags", () => {
    assert.match(catalog, /tags: \[PUBLIC_CACHE_TAGS\.products\]/);
    assert.match(catalog, /tags: \[PUBLIC_CACHE_TAGS\.categories\]/);
    assert.match(homeContent, /tags: \[PUBLIC_CACHE_TAGS\.homeContent\]/);
  });

  it("reads variant stock live instead of from the shared cache", () => {
    assert.match(catalog, /export async function loadLiveAvailability/);
    assert.doesNotMatch(catalog, /unstable_cache\(\s*\(?[^)]*\)?\s*=>\s*loadLiveAvailability/);
  });

  it("expires caches immediately rather than stale-while-revalidate", () => {
    const cacheModule = readFileSync("lib/cache/public-catalogue.ts", "utf8");
    assert.match(cacheModule, /revalidateTag\(tag, \{ expire: 0 \}\)/);
  });

  it("admin catalogue and CMS write routes expire the matching public tags", () => {
    const expectations: Array<[string, RegExp[]]> = [
      [
        "app/api/admin/products/route.ts",
        [
          /export const POST = withPublicCacheExpiry\(createProduct, \[PUBLIC_CACHE_TAGS\.products\]\)/,
          /export const PUT = withPublicCacheExpiry\(updateProduct, \[PUBLIC_CACHE_TAGS\.products\]\)/,
          /export const PATCH = withPublicCacheExpiry\(updateProductOccasions, \[PUBLIC_CACHE_TAGS\.products\]\)/,
        ],
      ],
      [
        "app/api/admin/inventory/route.ts",
        [/export const PATCH = withPublicCacheExpiry\(updateVariantStock, \[PUBLIC_CACHE_TAGS\.products\]\)/],
      ],
      [
        "app/api/admin/categories/route.ts",
        [
          /CATEGORY_CACHE_TAGS = \[PUBLIC_CACHE_TAGS\.categories, PUBLIC_CACHE_TAGS\.products\]/,
          /export const POST = withPublicCacheExpiry\(createCategory, CATEGORY_CACHE_TAGS\)/,
          /export const PATCH = withPublicCacheExpiry\(updateCategory, CATEGORY_CACHE_TAGS\)/,
          /export const DELETE = withPublicCacheExpiry\(deleteCategory, CATEGORY_CACHE_TAGS\)/,
        ],
      ],
      [
        "app/api/admin/categories/reorder/route.ts",
        [/export const PATCH = withPublicCacheExpiry\(reorderCategories, \[PUBLIC_CACHE_TAGS\.categories\]\)/],
      ],
      [
        "app/api/admin/homepage/route.ts",
        [/export const PATCH = withPublicCacheExpiry\(updateHomepageSections, \[PUBLIC_CACHE_TAGS\.homeContent\]\)/],
      ],
      [
        "app/api/admin/homepage/cms/route.ts",
        [/export const PATCH = withPublicCacheExpiry\(updateHomepageCms, \[PUBLIC_CACHE_TAGS\.homeContent\]\)/],
      ],
      [
        "app/api/admin/homepage/shop-by-occasion/route.ts",
        [/export const PATCH = withPublicCacheExpiry\(updateShopByOccasion, \[PUBLIC_CACHE_TAGS\.homeContent\]\)/],
      ],
      [
        "app/api/admin/reviews/route.ts",
        [
          /REVIEW_CACHE_TAGS = \[PUBLIC_CACHE_TAGS\.products, PUBLIC_CACHE_TAGS\.reviews\]/,
          /export const PATCH = withPublicCacheExpiry\(moderateReviewRequest, REVIEW_CACHE_TAGS\)/,
        ],
      ],
    ];
    for (const [file, patterns] of expectations) {
      const source = readFileSync(file, "utf8");
      for (const pattern of patterns) {
        assert.match(source, pattern, `${file} should match ${pattern}`);
      }
    }
  });

  it("checkout still authorises purchases from live database prices and stock", () => {
    const checkout = readFileSync("app/api/checkout/initialize/route.ts", "utf8");
    assert.match(checkout, /\.from\("variants"\)\s*\.select\("id, product_id, sku, price_ghs, stock"\)/);
    assert.match(checkout, /createServiceRoleClient\(\)/);
    assert.doesNotMatch(checkout, /lib\/data\/catalog|lib\/cache\/public-catalogue|unstable_cache/);
  });

  it("payment, webhook and auth paths do not use the public catalogue cache", () => {
    const sensitive = [
      "app/api/webhooks/moolre/route.ts",
      "app/api/checkout/payment-status/route.ts",
      "app/api/cron/reconcile-payments/route.ts",
      "lib/payments/reconcile-payment.ts",
      "lib/payments/mark-order-paid.ts",
      "lib/inventory/deduct-order-stock.ts",
      "lib/data/account-orders.ts",
      "proxy.ts",
    ];
    for (const file of sensitive) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /unstable_cache|lib\/cache\/public-catalogue|createPublicSupabaseClient/, file);
    }
  });
});
