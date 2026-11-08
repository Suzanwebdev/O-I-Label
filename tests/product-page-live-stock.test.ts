import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { before, beforeEach, describe, it } from "node:test";
import type { Product } from "../lib/types";

/**
 * Phase 2B Step 5: one live-stock read for the product page (main product plus
 * the first batch of related candidates). The page and metadata are called
 * directly against a fake Supabase (global fetch) and in-memory data cache — no
 * network, no database. Request-scoped sharing between metadata and page is
 * verified with real React Flight renders in tests/react-server/.
 */

type FakeVariant = { id: string; stock: number; size?: string };
type FakeProduct = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  category: string;
  occasions: string[];
  badges: string[];
  rating: number | null;
  variants: FakeVariant[];
};

type Kind = "product" | "catalogue" | "stock" | "collection_members" | "collection_peers" | "flag" | "reviews" | "auth" | "other";

const db = {
  products: [] as FakeProduct[],
  collections: [] as { collection_id: string; product_id: string }[],
  failStock: false,
};
const calls: { kind: Kind; ids: string[] | null }[] = [];
const cacheStore = new Map<string, unknown>();

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function inList(value: string | null): string[] | null {
  if (!value?.startsWith("in.")) return null;
  return value.replace(/^in\.\(/, "").replace(/\)$/, "").split(",").map((s) => s.replace(/^"|"$/g, ""));
}

function productRow(p: FakeProduct) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: "",
    seo_title: null,
    seo_description: null,
    is_active: p.is_active,
    badges: p.badges,
    occasions: p.occasions,
    love_it_points: [],
    rating: p.rating,
    review_count: null,
    categories: { slug: p.category, name: p.category },
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: `${v.id}-sku`,
      price_ghs: 100,
      compare_at_ghs: null,
      stock: v.stock,
      size: v.size ?? "M",
      color: "Black",
    })),
    product_images: [{ storage_path: `/img/${p.slug}.jpg`, sort_order: 0 }],
  };
}

async function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select") ?? "";
  const active = db.products.filter((p) => p.is_active);
  if (url.pathname === "/auth/v1/user") {
    calls.push({ kind: "auth", ids: null });
    return json({ msg: "no session" }, 401);
  }
  switch (table) {
    case "products": {
      if (select.startsWith("id,variants(id,stock)")) {
        const ids = inList(url.searchParams.get("id")) ?? [];
        calls.push({ kind: "stock", ids });
        if (db.failStock) return json({ message: "stock unavailable" }, 503);
        return json(
          active
            .filter((p) => ids.includes(p.id))
            .map((p) => ({ id: p.id, variants: p.variants.map((v) => ({ id: v.id, stock: v.stock })) }))
        );
      }
      const slug = url.searchParams.get("slug")?.replace(/^eq\./, "");
      calls.push({ kind: slug ? "product" : "catalogue", ids: null });
      return json(active.filter((p) => !slug || p.slug === slug).map(productRow));
    }
    case "collection_products": {
      if (select === "collection_id") {
        calls.push({ kind: "collection_members", ids: null });
        const productId = url.searchParams.get("product_id")?.replace(/^eq\./, "");
        return json(db.collections.filter((c) => c.product_id === productId).map((c) => ({ collection_id: c.collection_id })));
      }
      calls.push({ kind: "collection_peers", ids: null });
      const collectionIds = inList(url.searchParams.get("collection_id")) ?? [];
      const exclude = url.searchParams.get("product_id")?.replace(/^neq\./, "");
      return json(
        db.collections
          .filter((c) => collectionIds.includes(c.collection_id) && c.product_id !== exclude)
          .map((c) => ({ product_id: c.product_id }))
      );
    }
    case "site_settings":
      calls.push({ kind: "flag", ids: null });
      return json([{ feature_flags: { reviews: true } }]);
    case "reviews":
      calls.push({ kind: "reviews", ids: null });
      return json([], 200, { "content-range": "*/0" });
    default:
      calls.push({ kind: "other", ids: null });
      return json([]);
  }
}

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

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
const headersPath = requireFromRoot.resolve("next/headers");
const headersModule = new Module(headersPath);
headersModule.filename = headersPath;
headersModule.exports = {
  async cookies() {
    return { getAll: () => [], get: () => undefined, set: () => {} };
  },
};
headersModule.loaded = true;
requireFromRoot.cache[headersPath] = headersModule;

let page: typeof import("../app/(store)/product/[slug]/page");
let catalog: typeof import("../lib/data/catalog");
let related: typeof import("../lib/data/related-products");

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;
  page = await import("../app/(store)/product/[slug]/page");
  catalog = await import("../lib/data/catalog");
  related = await import("../lib/data/related-products");
});

/** Main product p0 plus 40 candidates; candidates ranked by name (same category, no other signal). */
function standardCatalogue(): FakeProduct[] {
  const products: FakeProduct[] = [
    {
      id: "p0",
      slug: "silk-dress",
      name: "Silk Dress",
      is_active: true,
      category: "dresses",
      occasions: ["wedding"],
      badges: [],
      rating: null,
      variants: [
        { id: "p0-s", stock: 5, size: "S" },
        { id: "p0-m", stock: 2, size: "M" },
      ],
    },
  ];
  for (let i = 1; i <= 40; i++) {
    products.push({
      id: `p${i}`,
      slug: `piece-${i}`,
      name: `Piece ${String(i).padStart(2, "0")}`,
      is_active: true,
      category: "dresses",
      occasions: [],
      badges: [],
      rating: null,
      variants: [{ id: `p${i}-v`, stock: 3 }],
    });
  }
  products.push({
    id: "sample",
    slug: "sample-only",
    name: "Sample Only",
    is_active: true,
    category: "dresses",
    occasions: [],
    badges: [],
    rating: null,
    variants: [],
  });
  return products;
}

beforeEach(() => {
  db.products = standardCatalogue();
  db.collections = [];
  db.failStock = false;
  calls.length = 0;
  cacheStore.clear();
});

function count(kind: Kind): number {
  return calls.filter((c) => c.kind === kind).length;
}

function stockCalls(): string[][] {
  return calls.filter((c) => c.kind === "stock").map((c) => c.ids!);
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

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

async function renderPage(slug = "silk-dress") {
  return page.default(params(slug)) as Promise<unknown>;
}

function relatedIds(tree: unknown): string[] {
  return (find(tree, "ProductYouMayAlsoLike")!.props.products as { id: string }[]).map((p) => p.id);
}

async function assertNotFound(promise: Promise<unknown>) {
  await assert.rejects(promise, (e: unknown) => /404/.test(String((e as { digest?: unknown }).digest)));
}

/** The pre-Step-5 pair, for parity. */
async function previousImplementation(slug: string): Promise<{ product: Product | null; related: string[] }> {
  const product = await catalog.getProductBySlugFromDb(slug);
  if (!product || product.variants.length === 0) return { product, related: [] };
  return { product, related: (await related.getRelatedProducts(product, 10)).map((p) => p.id) };
}

describe("query counts", () => {
  it("a warm product page makes one live-stock read: the product plus the first 20 ranked candidates", async () => {
    await renderPage();
    calls.length = 0;
    const tree = await renderPage();
    assert.equal(count("product") + count("catalogue"), 0, "rows from the data cache");
    const reads = stockCalls();
    assert.equal(reads.length, 1);
    const expectedCandidates = Array.from({ length: 20 }, (_, i) => `p${i + 1}`);
    assert.deepEqual(reads[0], ["p0", ...expectedCandidates]);
    assert.deepEqual(relatedIds(tree), expectedCandidates.slice(0, 10));
  });

  it("the cold path also makes one live-stock read", async () => {
    await renderPage();
    assert.equal(stockCalls().length, 1);
  });

  it("metadata and page each use the combined loader (shared per request via React cache)", async () => {
    const metadata = await page.generateMetadata(params("silk-dress"));
    assert.match(String(metadata.title), /Silk Dress/);
    assert.equal(stockCalls().length, 1, "metadata alone: one combined read");
    const source = readFileSync("lib/data/related-products.ts", "utf8");
    assert.match(source, /export const getProductPageData = cache\(async/);
  });

  it("a short first batch still reads the next batch, and results match the previous implementation", async () => {
    for (let i = 1; i <= 15; i++) db.products[i]!.variants[0]!.stock = 0;
    await renderPage();
    calls.length = 0;
    const tree = await renderPage();
    const reads = stockCalls();
    assert.equal(reads.length, 2, "first batch had only 5 purchasable, so a second batch is read");
    assert.deepEqual(reads[1], Array.from({ length: 20 }, (_, i) => `p${i + 21}`));
    const expected = await previousImplementation("silk-dress");
    assert.deepEqual(relatedIds(tree), expected.related);
    assert.deepEqual(relatedIds(tree), ["p16", "p17", "p18", "p19", "p20", "p21", "p22", "p23", "p24", "p25"]);
  });
});

describe("not-found and visibility", () => {
  it("an unknown slug is not found without stock, catalogue, collection, reviews or Auth work", async () => {
    await assertNotFound(renderPage("no-such-product"));
    for (const kind of ["stock", "catalogue", "collection_members", "flag", "reviews", "auth"] as Kind[]) {
      assert.equal(count(kind), 0, kind);
    }
    const metadata = await page.generateMetadata(params("no-such-product"));
    assert.equal(metadata.title, "Product Not Found");
  });

  it("a cached product with no variants is not found without stock, catalogue, collection, reviews or Auth work", async () => {
    await assertNotFound(renderPage("sample-only"));
    for (const kind of ["stock", "catalogue", "collection_members", "flag", "reviews", "auth"] as Kind[]) {
      assert.equal(count(kind), 0, `cold: no ${kind} request`);
    }
    assert.equal(count("product"), 1, "cold: only the product row (and its category links) is read");
    calls.length = 0;
    await assertNotFound(renderPage("sample-only"));
    assert.deepEqual(calls, [], "warm: no requests at all");
    // Deliberate Step 5 change: this 404 now carries not-found metadata (previously the product's own title).
    assert.equal((await page.generateMetadata(params("sample-only"))).title, "Product Not Found");
    assert.deepEqual(calls, [], "metadata adds no requests either");
  });

  it("a product unpublished after caching is not found, with not-found metadata, from a warm cache", async () => {
    await renderPage();
    db.products[0]!.is_active = false;
    calls.length = 0;
    await assertNotFound(renderPage());
    assert.equal(stockCalls().length, 1);
    for (const kind of ["flag", "reviews", "auth"] as Kind[]) assert.equal(count(kind), 0, kind);
    assert.equal((await page.generateMetadata(params("silk-dress"))).title, "Product Not Found");
  });

  it("a product deleted after caching is not found", async () => {
    await renderPage();
    db.products = db.products.filter((p) => p.id !== "p0");
    await assertNotFound(renderPage());
    assert.equal((await page.generateMetadata(params("silk-dress"))).title, "Product Not Found");
  });
});

describe("availability", () => {
  it("main-product stock changes and removed variants come from the live read", async () => {
    await renderPage();
    db.products[0]!.variants = [{ id: "p0-m", stock: 0, size: "M" }];
    const form = find(await renderPage(), "ProductVariantForm")!;
    const variants = (form.props.product as { variants: { id: string; in_stock: boolean }[] }).variants;
    assert.deepEqual(variants.map((v) => [v.id, v.in_stock]), [["p0-m", false]]);
  });

  it("a product whose variants were all removed is not found, with product metadata, as before", async () => {
    await renderPage();
    db.products[0]!.variants = [];
    await assertNotFound(renderPage());
    const before = await previousImplementation("silk-dress");
    const { product } = await related.getProductPageData("silk-dress");
    assert.deepEqual(product, before.product);
    assert.match(String((await page.generateMetadata(params("silk-dress"))).title), /Silk Dress/);
  });

  it("sold-out candidates are excluded and order matches the previous implementation", async () => {
    await renderPage();
    db.products[2]!.variants[0]!.stock = 0;
    db.products[5]!.is_active = false;
    const tree = await renderPage();
    const expected = await previousImplementation("silk-dress");
    assert.deepEqual(relatedIds(tree), expected.related);
    assert.ok(!relatedIds(tree).includes("p2") && !relatedIds(tree).includes("p5"));
  });

  it("collection peers and ties rank exactly as before", async () => {
    db.collections = [
      { collection_id: "c1", product_id: "p0" },
      { collection_id: "c1", product_id: "p33" },
      { collection_id: "c1", product_id: "p40" },
    ];
    for (const p of db.products.slice(1, 6)) p.name = "Same Name";
    await renderPage();
    const tree = await renderPage();
    const expected = await previousImplementation("silk-dress");
    assert.deepEqual(relatedIds(tree), expected.related);
    assert.deepEqual(relatedIds(tree).slice(0, 2), ["p33", "p40"]);
  });

  it("randomised catalogues: product and related products equal the previous implementation", async () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const categories = ["dresses", "tops", "sets"];
    const occasions = ["birthday", "vacation", "wedding", "corporate"];
    for (let round = 0; round < 40; round++) {
      const size = 3 + Math.floor(rand() * 60);
      const truth: FakeProduct[] = Array.from({ length: size }, (_, i) => ({
        id: `r${i}`,
        slug: `r-${i}`,
        name: `Item ${String.fromCharCode(65 + Math.floor(rand() * 6))}${i % 3}`,
        is_active: true,
        category: categories[Math.floor(rand() * categories.length)]!,
        occasions: occasions.filter(() => rand() < 0.3),
        badges: rand() < 0.2 ? ["best_seller"] : rand() < 0.2 ? ["new"] : [],
        rating: rand() < 0.5 ? Math.round(rand() * 50) / 10 : null,
        variants: rand() < 0.08 ? [] : [0, 1].map((k) => ({ id: `r${i}v${k}`, stock: rand() < 0.5 ? 0 : 4 })),
      }));
      truth[0]!.variants = [{ id: "r0v0", stock: 1 }];
      db.collections = truth.filter(() => rand() < 0.2).map((p) => ({ collection_id: "c", product_id: p.id }));
      db.collections.push({ collection_id: "c", product_id: "r0" });
      cacheStore.clear();
      db.products = truth.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, stock: rand() < 0.5 ? 9 : 0 })) }));
      await related.getProductPageData("r-0");
      db.products = truth;
      for (const p of db.products) if (rand() < 0.05) p.is_active = false;
      db.products[0]!.is_active = true;

      const after = await related.getProductPageData("r-0");
      const previous = await previousImplementation("r-0");
      assert.deepEqual(after.product, previous.product, `round ${round}: product`);
      assert.deepEqual(after.related.map((p) => p.id), previous.related, `round ${round}: related`);
    }
  });
});

describe("failure handling", () => {
  it("a failed combined read reloads the product fresh and uses the existing related fallback", async () => {
    await renderPage();
    db.products[0]!.variants[0]!.stock = 0;
    db.products[1]!.variants[0]!.stock = 0;
    db.failStock = true;
    calls.length = 0;
    const tree = await renderPage();
    assert.ok(count("product") >= 1, "product reloaded fresh");
    assert.ok(count("catalogue") >= 1, "related products reloaded fresh");
    const form = find(tree, "ProductVariantForm")!;
    const variants = (form.props.product as { variants: { id: string; in_stock: boolean }[] }).variants;
    assert.deepEqual(variants.map((v) => [v.id, v.in_stock]), [["p0-s", false], ["p0-m", true]], "no stale availability");
    assert.ok(!relatedIds(tree).includes("p1"), "a candidate sold out in the database is not shown as purchasable");
    const expected = await previousImplementation("silk-dress");
    assert.deepEqual(relatedIds(tree), expected.related);
  });
});

describe("request-scoped sharing (react-server build)", () => {
  it("metadata and page in one render share one live read; separate renders do not", () => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: "" };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "tests/react-server/product-page-live-stock.rsc.ts"],
      { encoding: "utf8", env }
    );
    assertChildSuitePassed(result);
  });
});

/**
 * The child must exit 0 and print exactly one run summary with no failures and
 * at least one pass. Node's spec reporter prints `ℹ fail 0`; TAP (Node 20's
 * default without a TTY, as in CI) prints `# fail 0`.
 */
function assertChildSuitePassed(result: SpawnSyncReturns<string>): void {
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.error, undefined, output);
  assert.equal(result.status, 0, output);
  const summaryCount = (name: "pass" | "fail"): number => {
    const counts = [...result.stdout.matchAll(new RegExp(`^(?:ℹ|#) ${name} (\\d+)\\r?$`, "gm"))].map((m) => Number(m[1]));
    assert.equal(counts.length, 1, `expected exactly one "${name}" summary line\n${output}`);
    return counts[0]!;
  };
  assert.equal(summaryCount("fail"), 0, output);
  assert.ok(summaryCount("pass") > 0, `no passing tests reported\n${output}`);
}

describe("stock stays out of data caches", () => {
  it("the combined loader is request-scoped only", () => {
    const source = readFileSync("lib/data/related-products.ts", "utf8");
    const loader = source.slice(source.indexOf("export const getProductPageData"));
    assert.match(loader, /^export const getProductPageData = cache\(/);
    assert.doesNotMatch(loader, /unstable_cache/);
    const cachedBlocks = source.split("unstable_cache(").slice(1).map((block) => block.slice(0, block.indexOf("\n);")));
    for (const block of cachedBlocks) assert.doesNotMatch(block, /loadLiveAvailability|readProductBySlug|stock/);
  });
});
