import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { before, beforeEach, describe, it } from "node:test";
import type { Product } from "../lib/types.ts";

/**
 * Behavioural tests for public catalogue caching. Supabase is replaced by an
 * in-memory PostgREST fake (global fetch) and Next's data cache by an
 * in-memory incremental cache — nothing here touches a real database.
 */

type FakeVariant = { id: string; stock: number; price_ghs?: number };
type FakeProduct = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  category: string;
  badges?: string[];
  variants: FakeVariant[];
};

const db = {
  products: [] as FakeProduct[],
  failStock: false,
  failAll: false,
};
const requests: { kind: "catalogue" | "stock" | "product_categories" | "other"; url: URL }[] = [];
const cacheStore = new Map<string, unknown>();

function productRow(p: FakeProduct) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: "",
    seo_title: null,
    seo_description: null,
    is_active: p.is_active,
    badges: p.badges ?? [],
    occasions: [],
    love_it_points: [],
    rating: null,
    review_count: 0,
    categories: { slug: p.category, name: p.category },
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: `${v.id}-sku`,
      price_ghs: v.price_ghs ?? 100,
      compare_at_ghs: null,
      stock: v.stock,
      size: "M",
      color: "Black",
    })),
    product_images: [],
  };
}

function inValues(param: string | null): string[] | null {
  if (!param) return null;
  return param
    .replace(/^in\.\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((s) => s.replace(/^"|"$/g, ""));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select") ?? "";

  if (table === "product_categories") {
    requests.push({ kind: "product_categories", url });
    return db.failAll ? json({ message: "down" }, 503) : json([]);
  }
  if (table !== "products") {
    requests.push({ kind: "other", url });
    return json([]);
  }

  const isStockQuery = select.startsWith("id,variants(id,stock)");
  requests.push({ kind: isStockQuery ? "stock" : "catalogue", url });
  if (db.failAll || (isStockQuery && db.failStock)) return json({ message: "unavailable" }, 503);

  let rows = db.products.filter((p) => p.is_active);
  const slug = url.searchParams.get("slug");
  if (slug) rows = rows.filter((p) => p.slug === slug.replace(/^eq\./, ""));
  const ids = inValues(url.searchParams.get("id"));
  if (ids) rows = rows.filter((p) => ids.includes(p.id));

  if (isStockQuery) {
    return json(rows.map((p) => ({ id: p.id, variants: p.variants.map((v) => ({ id: v.id, stock: v.stock })) })));
  }
  return json(rows.map(productRow));
}

const fakeIncrementalCache = {
  isOnDemandRevalidate: false,
  async generateCacheKey(key: string) {
    return key;
  },
  async get(key: string) {
    return cacheStore.has(key) ? { isStale: false, value: cacheStore.get(key) } : null;
  },
  async set(key: string, data: unknown) {
    cacheStore.set(key, data);
  },
};

function count(kind: (typeof requests)[number]["kind"]): number {
  return requests.filter((r) => r.kind === kind).length;
}

function productBySlugEntries(): number {
  return [...cacheStore.keys()].filter((k) => k.includes("product-by-slug")).length;
}

type CatalogModule = typeof import("../lib/data/catalog.ts");
type RelatedModule = typeof import("../lib/data/related-products.ts");
let catalog: CatalogModule;
let related: RelatedModule;

before(async () => {
  // Next's server runtime normally installs this before unstable_cache runs.
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;
  catalog = await import("../lib/data/catalog.ts");
  related = await import("../lib/data/related-products.ts");
});

beforeEach(() => {
  db.products = [
    { id: "p1", slug: "silk-dress", name: "Silk Dress", is_active: true, category: "dresses", variants: [{ id: "v1", stock: 5 }] },
    { id: "p2", slug: "linen-top", name: "Linen Top", is_active: true, category: "tops", variants: [{ id: "v2", stock: 3 }] },
    { id: "p3", slug: "midi-dress", name: "Midi Dress", is_active: true, category: "dresses", variants: [{ id: "v3", stock: 2 }] },
  ];
  db.failStock = false;
  db.failAll = false;
  requests.length = 0;
  cacheStore.clear();
});

describe("product page metadata", () => {
  type PageModule = typeof import("../app/(store)/product/[slug]/page.tsx");
  let page: PageModule;

  before(async () => {
    page = await import("../app/(store)/product/[slug]/page.tsx");
  });

  async function metadataTitle(slug: string): Promise<unknown> {
    const metadata = await page.generateMetadata({ params: Promise.resolve({ slug }) });
    return metadata.title;
  }

  it("active products keep their product metadata", async () => {
    const metadata = await page.generateMetadata({ params: Promise.resolve({ slug: "silk-dress" }) });
    assert.match(String(metadata.title), /Silk Dress/);
    assert.match(String(metadata.alternates?.canonical), /\/product\/silk-dress$/);
  });

  it("missing products get not-found metadata", async () => {
    assert.equal(await metadataTitle("does-not-exist"), "Product Not Found");
  });

  it("a product unpublished outside the admin panel gets not-found metadata despite a warm cache", async () => {
    assert.match(String(await metadataTitle("silk-dress")), /Silk Dress/);
    assert.equal(productBySlugEntries(), 1, "the active product is cached");

    db.products[0]!.is_active = false;
    assert.equal(await metadataTitle("silk-dress"), "Product Not Found");
  });

  it("a product deleted outside the admin panel gets not-found metadata despite a warm cache", async () => {
    assert.match(String(await metadataTitle("silk-dress")), /Silk Dress/);
    db.products = db.products.filter((p) => p.id !== "p1");
    assert.equal(await metadataTitle("silk-dress"), "Product Not Found");
  });

  it("not-found metadata does not create cache entries", async () => {
    await metadataTitle("does-not-exist");
    await metadataTitle("another-missing-slug");
    assert.equal(productBySlugEntries(), 0);
  });

  it("warm metadata uses the cached product plus the one live check the page also needs", async () => {
    await metadataTitle("silk-dress");
    requests.length = 0;
    await metadataTitle("silk-dress");
    assert.equal(count("catalogue"), 0);
    assert.equal(count("stock"), 1);
  });
});

describe("sitemap never reads stock", () => {
  it("sitemap product list never reads stock", async () => {
    const products = await catalog.listProductsForSitemap();
    assert.deepEqual(
      products.map((p) => p.slug).sort(),
      ["linen-top", "midi-dress", "silk-dress"]
    );
    assert.equal(count("stock"), 0);
  });
});

describe("product page lookups", () => {
  it("a warm product page read issues exactly one stock query and no product query", async () => {
    await catalog.getProductBySlugFromDb("silk-dress");
    requests.length = 0;

    const product = await catalog.getProductBySlugFromDb("silk-dress");
    assert.equal(product?.variants[0]?.stock, 5);
    assert.equal(count("catalogue"), 0);
    assert.equal(count("stock"), 1);
    assert.deepEqual(inValues(requests[0]!.url.searchParams.get("id")), ["p1"]);
  });

  it("metadata and page share one request-scoped React cache() lookup", () => {
    const source = readFileSync("lib/data/catalog.ts", "utf8");
    assert.match(source, /const readProductBySlug = cache\(/);
    assert.match(source, /export const getProductBySlugFromDb = cache\(/);
    assert.match(source, /export const getCatalogueSnapshot = cache\(/);
    const page = readFileSync("app/(store)/product/[slug]/page.tsx", "utf8");
    const metadataFn = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("export default"));
    const pageFn = page.slice(page.indexOf("export default async function ProductPage"));
    assert.match(metadataFn, /getProductBySlugFromDb\(decodeURIComponent\(slug\)\)/);
    assert.match(pageFn, /getProductBySlugFromDb\(decodeURIComponent\(slug\)\)/);
  });
});

describe("unknown product URLs", () => {
  it("do not create cache entries, while real products still cache", async () => {
    for (const slug of ["nope-1", "nope-2", "nope-1", "wp-login.php"]) {
      assert.equal(await catalog.getProductBySlugFromDb(slug), null);
    }
    assert.equal(productBySlugEntries(), 0);

    await catalog.getProductBySlugFromDb("silk-dress");
    assert.equal(productBySlugEntries(), 1);
  });
});

describe("live stock and visibility", () => {
  it("listing pages show live stock, not cached stock", async () => {
    await catalog.listProducts();
    db.products[0]!.variants[0]!.stock = 0;
    const products = await catalog.listProducts();
    assert.equal(products.find((p) => p.id === "p1")?.variants[0]?.stock, 0);
  });

  it("category pages read live stock only for that category", async () => {
    await catalog.listProducts();
    requests.length = 0;
    const products = await catalog.listProductsInCategory("dresses");
    assert.deepEqual(
      products.map((p) => p.id).sort(),
      ["p1", "p3"]
    );
    const stock = requests.filter((r) => r.kind === "stock");
    assert.equal(stock.length, 1);
    assert.deepEqual(inValues(stock[0]!.url.searchParams.get("id"))?.sort(), ["p1", "p3"]);
  });

  it("a product unpublished outside the admin panel disappears despite a warm cache", async () => {
    await catalog.listProducts();
    await catalog.getProductBySlugFromDb("silk-dress");
    db.products[0]!.is_active = false;

    const products = await catalog.listProducts();
    assert.equal(products.some((p) => p.id === "p1"), false);
    assert.equal(await catalog.getProductBySlugFromDb("silk-dress"), null);
  });

  it("when the live stock read fails, products are reloaded fresh instead of showing cached stock", async () => {
    await catalog.listProducts();
    await catalog.getProductBySlugFromDb("silk-dress");
    db.products[0]!.variants[0]!.stock = 0;
    db.failStock = true;
    requests.length = 0;

    const products = await catalog.listProducts();
    assert.equal(products.find((p) => p.id === "p1")?.variants[0]?.stock, 0);
    const product = await catalog.getProductBySlugFromDb("silk-dress");
    assert.equal(product?.variants[0]?.stock, 0);
    assert.ok(count("catalogue") >= 2, "fresh database reads replaced the unverified cached data");
  });

  it("when Supabase is unavailable, cached stock is never presented as live", async () => {
    await catalog.listProducts();
    await catalog.getProductBySlugFromDb("silk-dress");
    db.failAll = true;

    assert.deepEqual(await catalog.listProducts(), []);
    assert.equal(await catalog.getProductBySlugFromDb("silk-dress"), null);
    assert.deepEqual(await catalog.listProductsInCategory("dresses"), []);
  });
});

describe("related products", () => {
  function original(current: Product, catalogProducts: Product[], peers: Set<string>, limit: number) {
    const isPurchasable = (p: Product) => p.is_active && p.variants.length > 0 && p.variants.some((v) => v.stock > 0);
    const score = (c: Product) => {
      let s = 0;
      if (peers.has(c.id)) s += 100;
      if (c.category_slug === current.category_slug) s += 50;
      const occ = new Set(current.occasions ?? []);
      for (const t of c.occasions ?? []) if (occ.has(t)) s += 15;
      if (c.badges.includes("best_seller")) s += 8;
      if (c.badges.includes("new")) s += 4;
      return s + (c.rating ?? 0);
    };
    const ranked = catalogProducts
      .filter((p) => p.id !== current.id && isPurchasable(p))
      .map((product) => ({ product, score: score(product) }))
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.product.name.localeCompare(b.product.name)));
    const withSignal = ranked.filter((r) => r.score > 0);
    const pool = withSignal.length >= limit ? withSignal : ranked;
    return pool.slice(0, limit).map((r) => r.product.id);
  }

  function randomProduct(i: number, rand: () => number): Product {
    const cats = ["dresses", "tops", "sets"];
    const occasions = ["birthday", "vacation", "wedding", "corporate"] as const;
    return {
      id: `p${i}`,
      slug: `p${i}`,
      name: `Product ${String.fromCharCode(65 + Math.floor(rand() * 26))}${i % 7}`,
      description: "",
      category_slug: cats[Math.floor(rand() * cats.length)]!,
      category_name: "x",
      category_slugs: [],
      images: [],
      badges: rand() < 0.3 ? ["best_seller"] : rand() < 0.3 ? ["new"] : [],
      occasions: occasions.filter(() => rand() < 0.3),
      rating: rand() < 0.5 ? Math.round(rand() * 50) / 10 : undefined,
      variants:
        rand() < 0.1
          ? []
          : [0, 1].map((k) => ({ id: `p${i}v${k}`, sku: "s", price_ghs: 10, stock: rand() < 0.4 ? 0 : 3 })),
      is_active: true,
    } as Product;
  }

  it("selects exactly what the original full-catalogue algorithm selected", async () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let round = 0; round < 40; round++) {
      const truth = Array.from({ length: 5 + Math.floor(rand() * 60) }, (_, i) => randomProduct(i, rand));
      const cachedStale = truth.map((p) => ({
        ...p,
        variants: p.variants.map((v) => ({ ...v, stock: rand() < 0.5 ? 9 : 0 })),
      }));
      const current = truth[0]!;
      const peers = new Set(truth.filter(() => rand() < 0.2).map((p) => p.id));
      const live = new Map(truth.map((p) => [p.id, new Map(p.variants.map((v) => [v.id, v.stock]))]));
      const limit = 1 + Math.floor(rand() * 12);

      const ranked = related.rankRelatedCandidates(current, cachedStale, peers);
      const picked = await related.pickPurchasableInRankOrder(ranked, limit, async (ids) =>
        new Map(ids.filter((id) => live.has(id)).map((id) => [id, live.get(id)!]))
      );
      assert.deepEqual(
        picked?.map((p) => p.id),
        original(current, truth, peers, limit),
        `round ${round}`
      );
    }
  });

  it("reads live stock for top-ranked batches only and stops once enough are purchasable", async () => {
    const products = Array.from({ length: 100 }, (_, i) =>
      ({
        id: `p${i}`,
        slug: `p${i}`,
        name: `Product ${String(i).padStart(3, "0")}`,
        description: "",
        category_slug: "dresses",
        category_name: "Dresses",
        category_slugs: ["dresses"],
        images: [],
        badges: [],
        occasions: [],
        variants: [{ id: `v${i}`, sku: "s", price_ghs: 10, stock: 1 }],
        is_active: true,
      }) as Product
    );
    const calls: string[][] = [];
    const picked = await related.pickPurchasableInRankOrder(products, 10, async (ids) => {
      calls.push(ids);
      return new Map(ids.map((id) => [id, new Map([[`v${id.slice(1)}`, 1]])]));
    });
    assert.equal(picked?.length, 10);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.length, 20);
  });

  it("returns null when live availability cannot be verified", async () => {
    const products = [
      { id: "a", name: "A", badges: [], variants: [{ id: "va", stock: 1 }], is_active: true } as unknown as Product,
    ];
    assert.equal(await related.pickPurchasableInRankOrder(products, 1, async () => null), null);
  });
});
