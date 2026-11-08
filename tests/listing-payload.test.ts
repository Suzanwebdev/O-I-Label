import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { before, beforeEach, describe, it } from "node:test";
import type * as ReactNamespace from "react";
import type { Product } from "../lib/types";
import type { StorefrontListingProduct, StorefrontProduct } from "../lib/catalog/storefront-product";

/**
 * Listing-specific product payload (Phase 2B Step 4A). Components are rendered
 * to static HTML with the full and the listing shape and must produce identical
 * markup; the add-to-bag button and restock dialog are replaced by recorders so
 * their props (cart payload, product) can be compared. Pages run against a fake
 * Supabase (global fetch) and in-memory data cache — no network, no database.
 */

const OMITTED_PRODUCT_FIELDS = ["seo_title", "seo_description", "love_it_points", "review_count"];

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));

/** `file` is a repo-relative source path, or an absolute path already resolved by Node. */
function stubModule(file: string, exports: unknown) {
  const filename = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.exports = exports;
  mod.loaded = true;
  requireFromRoot.cache[filename] = mod;
}

let React: typeof ReactNamespace;
let renderToStaticMarkup: (element: ReactNamespace.ReactElement) => string;

type Recorded = { component: string; props: Record<string, unknown> };
const recorded: Recorded[] = [];
let searchParams = new URLSearchParams();

function recorder(component: string) {
  return function Recorder(props: Record<string, unknown>) {
    const { children, ...rest } = props;
    recorded.push({ component, props: rest });
    return React.createElement("div", { "data-recorded": component }, children as ReactNamespace.ReactNode);
  };
}

function passthrough(tag: string) {
  return function Passthrough(props: Record<string, unknown>) {
    const { children, className } = props;
    return React.createElement(tag, { className }, children as ReactNamespace.ReactNode);
  };
}

// ---------- fixtures ----------

function fixtureProducts(): Product[] {
  return [
    {
      id: "p1",
      slug: "silk-dress",
      name: "Silk Dress",
      description: "Bias-cut silk for evening events",
      seo_title: "Silk Dress | Evening",
      seo_description: "A bias-cut silk dress for evening events and weddings.",
      category_slug: "dresses",
      category_name: "Dresses",
      category_slugs: ["dresses", "new-arrivals"],
      images: ["/fixtures/silk-1.jpg", "/fixtures/silk-2.jpg", "/fixtures/silk-3.jpg"],
      badges: ["best_seller", "new"],
      love_it_points: ["Fully lined", "Hand finished"],
      occasions: ["wedding"],
      rating: 4.5,
      review_count: 12,
      is_active: true,
      variants: [
        { id: "v1", sku: "SILK-DRESS-BLACK-S-0001", size: "S", color: "Black", price_ghs: 450, compare_at_ghs: 520, stock: 0 },
        { id: "v2", sku: "SILK-DRESS-BLACK-M-0002", size: "M", color: "Black", price_ghs: 450, compare_at_ghs: 520, stock: 3 },
        { id: "v3", sku: "SILK-DRESS-IVORY-L-0003", size: "L", color: "Ivory", price_ghs: 480, stock: 2 },
      ],
    },
    {
      id: "p2",
      slug: "linen-top",
      name: "Linen Top",
      description: "Breathable linen for warm days",
      seo_title: null,
      seo_description: null,
      category_slug: "tops",
      category_name: "Tops",
      category_slugs: ["tops"],
      images: ["/fixtures/linen-1.jpg", "/fixtures/linen-2.jpg"],
      badges: ["trending"],
      occasions: ["vacation"],
      rating: 4.9,
      review_count: 3,
      is_active: true,
      variants: [
        { id: "v4", sku: "LINEN-TOP-WHITE-XS", size: "XS", color: "White", price_ghs: 200, stock: 5 },
        { id: "v5", sku: "LINEN-TOP-NAVY-M", size: "M", color: "Navy", price_ghs: 220, stock: 0 },
      ],
    },
    {
      id: "p3",
      slug: "sold-out-gown",
      name: "Sold Out Gown",
      description: "",
      category_slug: "dresses",
      category_name: "Dresses",
      images: ["/fixtures/gown-1.jpg"],
      badges: ["limited"],
      occasions: ["corporate"],
      is_active: true,
      variants: [
        { id: "v6", sku: "GOWN-RED-M", size: "M", color: "Red", price_ghs: 900, stock: 0 },
        { id: "v7", sku: "GOWN-RED-L", size: "L", color: "Red", price_ghs: 900, stock: 0 },
      ],
    },
    {
      id: "p4",
      slug: "satin-skirt",
      name: "Satin Skirt",
      description: "Satin midi skirt",
      category_slug: "bottoms",
      category_name: "Bottoms",
      category_slugs: ["bottoms"],
      images: ["/fixtures/skirt-1.jpg", "/fixtures/skirt-2.jpg", "/fixtures/skirt-3.jpg", "/fixtures/skirt-4.jpg"],
      badges: [],
      love_it_points: ["Bias cut"],
      occasions: ["birthday"],
      rating: 3.8,
      review_count: 1,
      is_active: true,
      variants: [
        { id: "v8", sku: "SKIRT-GREEN-S", size: "S", color: "Green", price_ghs: 150, stock: 1 },
        { id: "v9", sku: "SKIRT-GREEN-2XL", size: "2XL", color: "Green", price_ghs: 150, stock: 4 },
      ],
    },
    {
      id: "p5",
      slug: "retired-sample",
      name: "Retired Sample",
      description: "No longer sold",
      category_slug: "dresses",
      category_name: "Dresses",
      images: ["/fixtures/sample-1.jpg", "/fixtures/sample-2.jpg"],
      badges: ["sale"],
      is_active: false,
      variants: [{ id: "v10", sku: "SAMPLE-M", size: "M", color: "Black", price_ghs: 100, stock: 0 }],
    },
  ];
}

type StorefrontModule = typeof import("../lib/catalog/storefront-product");
type ShopUtilsModule = typeof import("../lib/shop-utils");
type RestockUiModule = typeof import("../lib/restock-notifications/ui");
let storefront: StorefrontModule;
let shopUtils: ShopUtilsModule;
let restockUi: RestockUiModule;

let full: StorefrontProduct[];
let listing: StorefrontListingProduct[];

// ---------- fake Supabase for page tests ----------

const cacheStore = new Map<string, unknown>();
const fakeIncrementalCache = {
  isOnDemandRevalidate: false,
  async generateCacheKey(key: string) {
    return key;
  },
  async get(key: string) {
    return cacheStore.has(key) ? { isStale: false, value: cacheStore.get(key) } : null;
  },
  async set(key: string, value: unknown) {
    cacheStore.set(key, value);
  },
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function dbRow(p: Product) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    seo_title: p.seo_title ?? null,
    seo_description: p.seo_description ?? null,
    is_active: true,
    badges: p.badges,
    occasions: p.occasions ?? [],
    love_it_points: p.love_it_points ?? [],
    rating: p.rating ?? null,
    review_count: p.review_count ?? null,
    categories: { slug: p.category_slug, name: p.category_name },
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      price_ghs: v.price_ghs,
      compare_at_ghs: v.compare_at_ghs ?? null,
      stock: v.stock,
      size: v.size ?? null,
      color: v.color ?? null,
    })),
    product_images: p.images.map((storage_path, sort_order) => ({ storage_path, sort_order })),
  };
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : undefined;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const headers = new Headers(init?.headers ?? request?.headers);
  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select") ?? "";
  const active = fixtureProducts().filter((p) => p.is_active);
  const single = (rows: unknown[]) =>
    (headers.get("accept") ?? "").includes("vnd.pgrst.object") ? json(rows[0] ?? null, rows.length ? 200 : 406) : json(rows);

  if (url.pathname === "/auth/v1/user") return json({ msg: "no session" }, 401);
  switch (table) {
    case "products": {
      if (select.startsWith("id,variants(id,stock)")) {
        const ids = (url.searchParams.get("id") ?? "").replace(/^in\.\(|\)$/g, "").split(",").map((s) => s.replace(/"/g, ""));
        return json(active.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, variants: p.variants.map((v) => ({ id: v.id, stock: v.stock })) })));
      }
      const slug = url.searchParams.get("slug")?.replace(/^eq\./, "");
      return single(active.filter((p) => !slug || p.slug === slug).map(dbRow));
    }
    case "product_categories":
      return json(
        active.flatMap((p) =>
          (p.category_slugs ?? []).filter((s) => s !== p.category_slug).map((slug) => ({ product_id: p.id, categories: { slug } }))
        )
      );
    case "categories":
      return json([
        { slug: "dresses", name: "Dresses", description: null, image_url: null },
        { slug: "tops", name: "Tops", description: null, image_url: null },
        { slug: "bottoms", name: "Bottoms", description: null, image_url: null },
        { slug: "new-arrivals", name: "New Arrivals", description: null, image_url: null },
      ]);
    case "home_content":
      return single([{ sections: {}, updated_at: "2026-11-01T00:00:00.000Z" }]);
    case "site_settings":
      return single([{ feature_flags: { reviews: false } }]);
    case "reviews":
      return json([], 200, { "content-range": "*/0" });
    default:
      return json([]);
  }
}

// ---------- setup ----------

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;

  React = (await import("react")).default as unknown as typeof ReactNamespace;
  renderToStaticMarkup = (await import("react-dom/server")).renderToStaticMarkup;

  const navigationPath = requireFromRoot.resolve("next/navigation");
  const realNavigation = requireFromRoot("next/navigation") as Record<string, unknown>;
  requireFromRoot.cache[navigationPath]!.exports = {
    ...realNavigation,
    useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }),
    useSearchParams: () => searchParams,
  };
  stubModule(requireFromRoot.resolve("next/headers"), {
    async cookies() {
      return { getAll: () => [], get: () => undefined, set: () => {} };
    },
    async headers() {
      return new Headers();
    },
  });
  stubModule(path.join("components", "store-control", "purchase-actions.tsx"), { PurchaseActions: recorder("PurchaseActions") });
  stubModule(path.join("components", "store", "restock-notify-dialog.tsx"), {
    RestockNotifyDialog: recorder("RestockNotifyDialog"),
  });
  stubModule(path.join("components", "ui", "dialog.tsx"), {
    Dialog: passthrough("div"),
    DialogContent: passthrough("div"),
    DialogHeader: passthrough("div"),
    DialogTitle: passthrough("h2"),
    DialogDescription: passthrough("p"),
  });

  storefront = await import("../lib/catalog/storefront-product");
  shopUtils = await import("../lib/shop-utils");
  restockUi = await import("../lib/restock-notifications/ui");
});

beforeEach(() => {
  full = storefront.toStorefrontProducts(fixtureProducts());
  listing = storefront.toStorefrontListingProducts(fixtureProducts());
  recorded.length = 0;
  searchParams = new URLSearchParams();
  cacheStore.clear();
});

function render(element: ReactNamespace.ReactElement): { html: string; recorded: Recorded[] } {
  recorded.length = 0;
  const html = renderToStaticMarkup(element);
  return { html, recorded: recorded.splice(0) };
}

function assertSameOutput(make: (products: StorefrontListingProduct[]) => ReactNamespace.ReactElement, label: string) {
  const before = render(make(full));
  const after = render(make(listing));
  assert.ok(before.html.length > 0, `${label} rendered`);
  assert.equal(after.html, before.html, `${label}: identical markup`);
  assert.deepEqual(after.recorded.map((r) => r.component), before.recorded.map((r) => r.component));
  return { before, after };
}

function cartPayloads(records: Recorded[]) {
  return records.filter((r) => r.component === "PurchaseActions").map((r) => r.props.cartPayload);
}

// ---------- 1–4, 12: shape ----------

describe("listing shape", () => {
  it("excludes only the approved fields", () => {
    for (let i = 0; i < full.length; i++) {
      const expectedKeys = Object.keys(full[i]!).filter((k) => !OMITTED_PRODUCT_FIELDS.includes(k)).sort();
      assert.deepEqual(Object.keys(listing[i]!).sort(), expectedKeys);
      for (const key of expectedKeys) {
        if (key === "images" || key === "variants") continue;
        assert.deepEqual((listing[i] as Record<string, unknown>)[key], (full[i] as Record<string, unknown>)[key], key);
      }
    }
  });

  it("preserves product order", () => {
    assert.deepEqual(listing.map((p) => p.id), full.map((p) => p.id));
  });

  it("keeps the first image only, as an array", () => {
    for (let i = 0; i < full.length; i++) {
      assert.deepEqual(listing[i]!.images, [full[i]!.images[0]]);
    }
  });

  it("keeps every variant with id, availability, size, colour and prices — no stock count or SKU", () => {
    for (let i = 0; i < full.length; i++) {
      assert.equal(listing[i]!.variants.length, full[i]!.variants.length);
      listing[i]!.variants.forEach((variant, j) => {
        const fullVariant = full[i]!.variants[j]!;
        const expectedKeys = Object.keys(fullVariant).filter((k) => k !== "sku").sort();
        assert.deepEqual(Object.keys(variant).sort(), expectedKeys);
        assert.equal("stock" in variant, false);
        assert.equal("sku" in variant, false);
        for (const key of expectedKeys) {
          assert.deepEqual((variant as Record<string, unknown>)[key], (fullVariant as Record<string, unknown>)[key], key);
        }
      });
    }
  });

  it("does not mutate the source products", () => {
    const source = fixtureProducts();
    const copy = JSON.parse(JSON.stringify(source));
    storefront.toStorefrontListingProducts(source);
    assert.deepEqual(source, copy);
  });

  it("the serialized listing payload is smaller and carries none of the removed data", () => {
    const fullJson = JSON.stringify(full);
    const listingJson = JSON.stringify(listing);
    assert.ok(listingJson.length < fullJson.length, `${listingJson.length} < ${fullJson.length}`);
    for (const forbidden of [...OMITTED_PRODUCT_FIELDS, "sku", "silk-2.jpg", "skirt-4.jpg", "Fully lined", "SILK-DRESS"]) {
      assert.doesNotMatch(listingJson, new RegExp(forbidden));
    }
  });
});

// ---------- 5: search, filters, sorting ----------

describe("search, filters and sorting parity", () => {
  it("every filter and sort combination returns the same products in the same order", async () => {
    const { SHOP_FILTER_COLORS } = await import("../lib/shop-color-filter");
    const colourChoices = [undefined, [SHOP_FILTER_COLORS[0]!], [...SHOP_FILTER_COLORS]];
    let combinations = 0;
    for (const q of ["", "silk", "evening", "breath", "zzz"]) {
      for (const category of [undefined, "dresses", "new-arrivals", "tops"]) {
        for (const occasion of [undefined, "wedding", "vacation", "nope"]) {
          for (const tag of [undefined, "best_seller", "limited"]) {
            for (const [minPrice, maxPrice] of [[undefined, undefined], [200, undefined], [undefined, 450]] as const) {
              for (const sizes of [undefined, ["M"], ["XS", "2XL"]]) {
                for (const colors of colourChoices) {
                  for (const inStockOnly of [false, true]) {
                    const opts = { q, category, occasion, tag, minPrice, maxPrice, sizes, colors, inStockOnly };
                    const a = shopUtils.filterProducts(full, opts);
                    const b = shopUtils.filterProducts(listing, opts);
                    assert.deepEqual(b.map((p) => p.id), a.map((p) => p.id), JSON.stringify(opts));
                    for (const sort of ["best_sellers", "newest", "price_asc", "price_desc", "rated"]) {
                      assert.deepEqual(
                        shopUtils.sortProducts(b, sort).map((p) => p.id),
                        shopUtils.sortProducts(a, sort).map((p) => p.id),
                        `${sort} ${JSON.stringify(opts)}`
                      );
                    }
                    combinations++;
                  }
                }
              }
            }
          }
        }
      }
    }
    assert.ok(combinations > 1000);
  });

  it("search still matches descriptions", () => {
    assert.deepEqual(shopUtils.filterProducts(listing, { q: "evening" }).map((p) => p.id), ["p1"]);
  });
});

// ---------- 6, 7, 9: component output and cart payloads ----------

describe("component output is unchanged", () => {
  it("product cards: identical markup and cart payloads", async () => {
    const { ProductCard } = await import("../components/store/product-card");
    for (let i = 0; i < full.length; i++) {
      const { before, after } = assertSameOutput((products) => React.createElement(ProductCard, { product: products[i]! }), `card ${i}`);
      assert.deepEqual(cartPayloads(after.recorded), cartPayloads(before.recorded));
    }
    const { recorded: cards } = render(React.createElement(ProductCard, { product: listing[0]! }));
    assert.deepEqual(cartPayloads(cards), [
      {
        variantId: "v2",
        productId: "p1",
        productSlug: "silk-dress",
        name: "Silk Dress",
        image: "/fixtures/silk-1.jpg",
        size: "M",
        color: "Black",
        quantity: 1,
        unitPriceGhs: 450,
      },
    ]);
  });

  it("homepage best sellers: identical markup and cart payloads, including Show more", async () => {
    const { BestSellersRow } = await import("../components/home/best-sellers-row");
    const many = (products: StorefrontListingProduct[]) =>
      Array.from({ length: 4 }, (_, n) => products.map((p) => ({ ...p, id: `${p.id}-${n}` }))).flat();
    const { before, after } = assertSameOutput((products) => React.createElement(BestSellersRow, { products: many(products) }), "best sellers");
    assert.deepEqual(cartPayloads(after.recorded), cartPayloads(before.recorded));
    assert.match(after.html, /Show 8 more/);
  });

  it("quick view: identical markup and cart payload for in-stock and sold-out products", async () => {
    const { QuickViewModal } = await import("../components/shop/quick-view-modal");
    for (let i = 0; i < full.length; i++) {
      const { before, after } = assertSameOutput(
        (products) => React.createElement(QuickViewModal, { product: products[i]!, open: true, onOpenChange: () => {} }),
        `quick view ${i}`
      );
      assert.deepEqual(cartPayloads(after.recorded), cartPayloads(before.recorded));
    }
    const soldOut = render(React.createElement(QuickViewModal, { product: listing[2]!, open: true, onOpenChange: () => {} }));
    assert.match(soldOut.html, /Notify Me/);
    assert.match(soldOut.html, /Sold Out Gown/);
  });

  it("sold-out listing call to action and restock dialog product: unchanged", async () => {
    const { RestockNotifyListingCta } = await import("../components/store/restock-notify-listing-cta");
    for (let i = 0; i < full.length; i++) {
      const { before, after } = assertSameOutput(
        (products) => React.createElement(RestockNotifyListingCta, { product: products[i]! }),
        `restock cta ${i}`
      );
      const dialogProduct = (records: Recorded[]) =>
        records.filter((r) => r.component === "RestockNotifyDialog").map((r) => r.props.product as StorefrontListingProduct);
      const a = dialogProduct(before.recorded);
      const b = dialogProduct(after.recorded);
      assert.equal(b.length, a.length);
      for (let j = 0; j < a.length; j++) {
        assert.equal(b[j]!.id, a[j]!.id);
        assert.deepEqual(restockUi.collectProductSizes(b[j]!), restockUi.collectProductSizes(a[j]!));
        assert.deepEqual(restockUi.collectProductColors(b[j]!), restockUi.collectProductColors(a[j]!));
      }
    }
  });

  it("shop catalogue: identical markup for search, filters and sorting", async () => {
    const { ShopCatalog } = await import("../components/shop/shop-catalog");
    const expectedCounts: Record<string, string> = {
      "": "5 pieces",
      "q=silk": "1 piece",
      "q=breathable": "1 piece",
      "tag=best_seller": "1 piece",
      "occasion=wedding": "1 piece",
      "size=M&stock=1": "2 pieces",
      "sort=price_asc": "5 pieces",
      "sort=rated": "5 pieces",
      "min=200&max=450": "2 pieces",
    };
    for (const [query, count] of Object.entries(expectedCounts)) {
      searchParams = new URLSearchParams(query);
      const { after } = assertSameOutput((products) => React.createElement(ShopCatalog, { products, title: "All pieces" }), `shop ?${query}`);
      assert.match(after.html, new RegExp(`>${count}<`), `shop ?${query}`);
      assertSameOutput(
        (products) => React.createElement(ShopCatalog, { products, categorySlug: "dresses", title: "Dresses" }),
        `category ?${query}`
      );
    }
    searchParams = new URLSearchParams("sort=price_asc");
    const sorted = render(React.createElement(ShopCatalog, { products: listing, title: "All pieces" })).html;
    const order = ["Retired Sample", "Satin Skirt", "Linen Top", "Silk Dress", "Sold Out Gown"].map((name) => sorted.indexOf(name));
    assert.deepEqual([...order].sort((x, y) => x - y), order, "price low to high");
  });

  it("related products: identical markup", async () => {
    const { ProductYouMayAlsoLike } = await import("../components/product/product-you-may-also-like");
    assertSameOutput((products) => React.createElement(ProductYouMayAlsoLike, { products }), "you may also like");
  });
});

// ---------- 8, 9: rules ----------

describe("restock, sold-out and badge rules", () => {
  it("restock eligibility, dialog options, stock state, primary variant and listing badges match", () => {
    for (let i = 0; i < full.length; i++) {
      const a = full[i]!;
      const b = listing[i]!;
      assert.equal(restockUi.shouldShowRestockNotify(b), restockUi.shouldShowRestockNotify(a));
      assert.deepEqual(restockUi.collectProductSizes(b), restockUi.collectProductSizes(a));
      assert.deepEqual(restockUi.collectProductColors(b), restockUi.collectProductColors(a));
      assert.equal(storefront.isStorefrontProductInStock(b), storefront.isStorefrontProductInStock(a));
      assert.deepEqual(storefront.listingBadgesForStorefrontProduct(b), storefront.listingBadgesForStorefrontProduct(a));
      const { sku, ...primaryWithoutSku } = storefront.primaryStorefrontVariant(a);
      assert.ok(sku);
      assert.deepEqual(storefront.primaryStorefrontVariant(b), primaryWithoutSku);
    }
    assert.deepEqual(listing.map((p) => restockUi.shouldShowRestockNotify(p)), [false, false, true, false, false]);
  });
});

// ---------- 10, 11: pages ----------

type Element = { type: unknown; props: Record<string, unknown> };

function isElement(node: unknown): node is Element {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

function find(node: unknown, name: string): Element | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, name);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!isElement(node)) return undefined;
  if (typeof node.type === "function" && node.type.name === name) return node;
  return find(node.props.children, name);
}

function assertListingShape(products: unknown, label: string) {
  const list = products as Record<string, unknown>[];
  assert.ok(list.length > 0, `${label} has products`);
  for (const p of list) {
    for (const field of OMITTED_PRODUCT_FIELDS) assert.equal(field in p, false, `${label}: ${field}`);
    assert.equal((p.images as string[]).length, 1, `${label}: one image`);
    for (const v of p.variants as Record<string, unknown>[]) {
      assert.equal("sku" in v, false, `${label}: sku`);
      assert.equal("stock" in v, false, `${label}: stock`);
      assert.equal(typeof v.in_stock, "boolean");
    }
  }
}

describe("pages pass the listing shape", () => {
  it("homepage best sellers", async () => {
    const home = await import("../app/(store)/page");
    const tree = await home.default();
    const row = find(tree, "BestSellersRow")!;
    assertListingShape(row.props.products, "homepage");
    assert.deepEqual((row.props.products as { id: string }[]).map((p) => p.id), ["p1", "p2", "p3", "p4"]);
  });

  it("shop", async () => {
    const shop = await import("../app/(store)/shop/page");
    const tree = await shop.default();
    assertListingShape(find(tree, "ShopCatalog")!.props.products, "shop");
  });

  it("category", async () => {
    const category = await import("../app/(store)/shop/[category]/page");
    const tree = await category.default({ params: Promise.resolve({ category: "dresses" }) });
    const catalog = find(tree, "ShopCatalog")!;
    assertListingShape(catalog.props.products, "category");
    assert.deepEqual((catalog.props.products as { id: string }[]).map((p) => p.id).sort(), ["p1", "p3"]);
  });

  it("product page: related products are listing-shaped, the main product stays full", async () => {
    const productPage = await import("../app/(store)/product/[slug]/page");
    const tree = await productPage.default({ params: Promise.resolve({ slug: "silk-dress" }) });
    assertListingShape(find(tree, "ProductYouMayAlsoLike")!.props.products, "related");
    const main = find(tree, "ProductVariantForm")!.props.product as StorefrontProduct;
    assert.deepEqual(main.images, ["/fixtures/silk-1.jpg", "/fixtures/silk-2.jpg", "/fixtures/silk-3.jpg"]);
    assert.deepEqual(main.love_it_points, ["Fully lined", "Hand finished"]);
    assert.equal(main.seo_title, "Silk Dress | Evening");
    assert.equal(main.review_count, 12);
    assert.deepEqual(main.variants.map((v) => v.sku), ["SILK-DRESS-BLACK-S-0001", "SILK-DRESS-BLACK-M-0002", "SILK-DRESS-IVORY-L-0003"]);
    const gallery = find(tree, "ProductGallery")!;
    assert.equal((gallery.props.images as string[]).length, 3);
  });
});
