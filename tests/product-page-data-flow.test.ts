import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { before, beforeEach, describe, it } from "node:test";
import type { StorefrontProduct } from "../lib/catalog/storefront-product";

/**
 * Product page data flow: the page is called directly and the props of the
 * element tree it returns are inspected (no rendering). Supabase PostgREST and
 * Auth are a fake global fetch that can hold individual request kinds open,
 * Next's data cache is in memory and `next/headers` is stubbed — no network,
 * no database.
 */

type Kind =
  | "product"
  | "catalogue"
  | "stock"
  | "product_categories"
  | "collection_members"
  | "collection_peers"
  | "flag"
  | "review_aggregate"
  | "review_list"
  | "auth"
  | "other";

type FakeVariant = { id: string; stock: number; price_ghs: number; size: string; color: string };
type FakeProduct = {
  id: string;
  slug: string;
  name: string;
  category: { slug: string; name: string };
  occasions: string[];
  badges: string[];
  images: string[];
  variants: FakeVariant[];
};
type FakeReview = { id: string; product_id: string; rating: number; display_name: string; created_at: string };

const db = {
  products: [] as FakeProduct[],
  collections: [] as { collection_id: string; product_id: string }[],
  reviews: [] as FakeReview[],
  flags: { reviews: true } as Record<string, unknown>,
  failStock: false,
  failFlag: false,
  failReviews: false,
};
const users = new Map<string, { id: string; email: string; user_metadata: Record<string, unknown> }>();
const log: { kind: Kind; phase: "start" | "end" }[] = [];
const gates = new Map<Kind, Promise<void>>();
const cacheStore = new Map<string, unknown>();
let cookieJar: { name: string; value: string }[] = [];
let cookiesThrow = false;

const SUPABASE_URL = "https://unit-test.supabase.co";
const AUTH_COOKIE = "sb-unit-test-auth-token";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function param(url: URL, name: string, op: string): string | null {
  const value = url.searchParams.get(name);
  return value?.startsWith(`${op}.`) ? value.slice(op.length + 1) : null;
}

function inList(url: URL, name: string): string[] | null {
  const value = param(url, name, "in");
  if (!value) return null;
  return value
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((s) => s.replace(/^"|"$/g, ""));
}

function classify(url: URL): Kind {
  if (url.pathname === "/auth/v1/user") return "auth";
  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select") ?? "";
  if (table === "products") {
    if (select.startsWith("id,variants(id,stock)")) return "stock";
    return url.searchParams.has("slug") ? "product" : "catalogue";
  }
  if (table === "product_categories") return "product_categories";
  if (table === "collection_products") return select === "collection_id" ? "collection_members" : "collection_peers";
  if (table === "site_settings") return "flag";
  if (table === "reviews") return select === "rating" ? "review_aggregate" : "review_list";
  return "other";
}

function productRow(p: FakeProduct) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: `${p.name} description`,
    seo_title: null,
    seo_description: null,
    is_active: true,
    badges: p.badges,
    occasions: p.occasions,
    love_it_points: [],
    rating: null,
    review_count: null,
    categories: p.category,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: `${v.id}-sku`,
      price_ghs: v.price_ghs,
      compare_at_ghs: null,
      stock: v.stock,
      size: v.size,
      color: v.color,
    })),
    product_images: p.images.map((storage_path, sort_order) => ({ storage_path, sort_order })),
  };
}

function respond(kind: Kind, url: URL, init?: RequestInit, request?: Request): Response {
  switch (kind) {
    case "auth": {
      const auth = new Headers(init?.headers ?? request?.headers).get("authorization") ?? "";
      const user = users.get(auth.replace(/^Bearer /, ""));
      if (!user) return json({ code: 401, msg: "invalid JWT" }, 401);
      return json({ ...user, aud: "authenticated", role: "authenticated", app_metadata: {} });
    }
    case "product": {
      const slug = param(url, "slug", "eq");
      return json(db.products.filter((p) => p.slug === slug).map(productRow));
    }
    case "catalogue":
      return json(db.products.map(productRow));
    case "stock": {
      if (db.failStock) return json({ message: "stock unavailable" }, 503);
      const ids = inList(url, "id") ?? [];
      return json(
        db.products
          .filter((p) => ids.includes(p.id))
          .map((p) => ({ id: p.id, variants: p.variants.map((v) => ({ id: v.id, stock: v.stock })) }))
      );
    }
    case "collection_members": {
      const productId = param(url, "product_id", "eq");
      return json(db.collections.filter((c) => c.product_id === productId).map((c) => ({ collection_id: c.collection_id })));
    }
    case "collection_peers": {
      const ids = inList(url, "collection_id") ?? [];
      const exclude = param(url, "product_id", "neq");
      return json(
        db.collections
          .filter((c) => ids.includes(c.collection_id) && c.product_id !== exclude)
          .map((c) => ({ product_id: c.product_id }))
      );
    }
    case "flag":
      if (db.failFlag) return json({ message: "settings unavailable" }, 503);
      return json([{ feature_flags: db.flags }]);
    case "review_aggregate": {
      if (db.failReviews) return json({ message: "reviews unavailable" }, 503);
      const productId = param(url, "product_id", "eq");
      return json(db.reviews.filter((r) => r.product_id === productId).map((r) => ({ rating: r.rating })));
    }
    case "review_list": {
      if (db.failReviews) return json({ message: "reviews unavailable" }, 503);
      const productId = param(url, "product_id", "eq");
      const rows = db.reviews
        .filter((r) => r.product_id === productId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => ({
          id: r.id,
          rating: r.rating,
          title: null,
          body: `Review ${r.id}`,
          display_name: r.display_name,
          verified_purchase: true,
          purchased_color: null,
          purchased_size: null,
          created_at: r.created_at,
          published_at: r.created_at,
          review_media: [],
        }));
      const range = rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0";
      return json(rows, 200, { "content-range": range });
    }
    default:
      return json([]);
  }
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : undefined;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const kind = classify(url);
  log.push({ kind, phase: "start" });
  const gate = gates.get(kind);
  if (gate) await gate;
  const response = respond(kind, url, init, request);
  log.push({ kind, phase: "end" });
  return response;
}

/** Holds every request of `kind` open until the returned release function is called. */
function hold(kind: Kind): () => void {
  let release!: () => void;
  gates.set(
    kind,
    new Promise<void>((resolve) => {
      release = resolve;
    })
  );
  return () => {
    gates.delete(kind);
    release();
  };
}

function started(kind: Kind): number {
  return log.filter((e) => e.kind === kind && e.phase === "start").length;
}

function indexOf(kind: Kind, phase: "start" | "end"): number {
  return log.findIndex((e) => e.kind === kind && e.phase === phase);
}

async function waitFor(predicate: () => boolean, what: string, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
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
  async set(key: string, data: unknown) {
    cacheStore.set(key, data);
  },
};

function sessionCookie(token: string, user: { id: string; email: string }) {
  const session = {
    access_token: token,
    refresh_token: `${token}-refresh`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { ...user, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
  return { name: AUTH_COOKIE, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` };
}

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
const headersPath = requireFromRoot.resolve("next/headers");
const headersModule = new Module(headersPath);
headersModule.filename = headersPath;
headersModule.exports = {
  async cookies() {
    if (cookiesThrow) throw new Error("cookies unavailable");
    const jar = cookieJar;
    return {
      getAll: () => jar.map((c) => ({ ...c })),
      get: (name: string) => jar.find((c) => c.name === name),
      set: () => {},
    };
  },
};
headersModule.loaded = true;
requireFromRoot.cache[headersPath] = headersModule;

type Element = { type: unknown; props: Record<string, unknown> };
type PageModule = typeof import("../app/(store)/product/[slug]/page");
type JsonLdModule = typeof import("../lib/seo/json-ld");
let page: PageModule;
let jsonLd: JsonLdModule;

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;
  page = await import("../app/(store)/product/[slug]/page");
  jsonLd = await import("../lib/seo/json-ld");
});

const ama = { id: "user-ama", email: "ama@example.test" };

beforeEach(() => {
  const variant = (id: string, stock: number, price_ghs = 300): FakeVariant => ({
    id,
    stock,
    price_ghs,
    size: "M",
    color: "Black",
  });
  db.products = [
    {
      id: "p1",
      slug: "silk-dress",
      name: "Silk Dress",
      category: { slug: "dresses", name: "Dresses" },
      occasions: ["wedding"],
      badges: ["best_seller"],
      images: ["https://img.test/silk-1.jpg", "https://img.test/silk-2.jpg"],
      variants: [variant("v1", 5, 450)],
    },
    {
      id: "p2",
      slug: "midi-dress",
      name: "Midi Dress",
      category: { slug: "dresses", name: "Dresses" },
      occasions: [],
      badges: [],
      images: [],
      variants: [variant("v2", 3)],
    },
    {
      id: "p3",
      slug: "linen-top",
      name: "Linen Top",
      category: { slug: "tops", name: "Tops" },
      occasions: ["wedding"],
      badges: [],
      images: [],
      variants: [variant("v3", 0)],
    },
    {
      id: "p4",
      slug: "satin-skirt",
      name: "Satin Skirt",
      category: { slug: "bottoms", name: "Bottoms" },
      occasions: [],
      badges: [],
      images: [],
      variants: [variant("v4", 4)],
    },
    {
      id: "p5",
      slug: "sample-only",
      name: "Sample Only",
      category: { slug: "dresses", name: "Dresses" },
      occasions: [],
      badges: [],
      images: [],
      variants: [],
    },
  ];
  db.collections = [
    { collection_id: "c1", product_id: "p1" },
    { collection_id: "c1", product_id: "p2" },
  ];
  db.reviews = [
    { id: "r1", product_id: "p1", rating: 5, display_name: "Ama", created_at: "2026-10-01T10:00:00.000Z" },
    { id: "r2", product_id: "p1", rating: 4, display_name: "Esi", created_at: "2026-10-05T10:00:00.000Z" },
  ];
  db.flags = { reviews: true };
  db.failStock = false;
  db.failFlag = false;
  db.failReviews = false;
  users.clear();
  users.set("token-ama", { id: "user-ama", email: "ama@example.test", user_metadata: { full_name: "Ama Mensah" } });
  log.length = 0;
  gates.clear();
  cacheStore.clear();
  cookieJar = [];
  cookiesThrow = false;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
});

function renderPage(slug: string) {
  return page.default({ params: Promise.resolve({ slug }) }) as Promise<unknown>;
}

function isElement(node: unknown): node is Element {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

function elements(node: unknown, out: Element[] = []): Element[] {
  if (Array.isArray(node)) {
    for (const child of node) elements(child, out);
  } else if (isElement(node)) {
    out.push(node);
    elements(node.props.children, out);
  }
  return out;
}

function typeName(el: Element): string {
  return typeof el.type === "function" ? el.type.name : String(el.type);
}

function component(tree: unknown, name: string): Element | undefined {
  return elements(tree).find((el) => typeName(el) === name);
}

function text(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (isElement(node)) return text(node.props.children);
  return "";
}

function reviewSummaryLine(tree: unknown): string | undefined {
  return elements(tree)
    .filter((el) => el.type === "p")
    .map((el) => text(el))
    .find((t) => /review/i.test(t));
}

async function assertNotFound(promise: Promise<unknown>): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    const digest = (error as { digest?: unknown }).digest;
    assert.match(String(digest), /404/);
    return true;
  });
}

describe("concurrency and dependency ordering", () => {
  it("reviews and the session wait for the visibility decision, which now includes related-candidate preparation", async () => {
    cookieJar = [sessionCookie("token-ama", ama)];
    const releaseCollections = hold("collection_members");
    const rendering = renderPage("silk-dress");

    await waitFor(() => started("collection_members") === 1, "related-candidate preparation to start");
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(started("collection_peers"), 0, "the second collection query still waits for the first");
    assert.equal(started("stock"), 0, "the single live read waits for ranked candidates");
    for (const kind of ["flag", "review_aggregate", "review_list", "auth"] as Kind[]) {
      assert.equal(started(kind), 0, `${kind} waits for the not-found check`);
    }

    releaseCollections();
    const tree = await rendering;
    assert.ok(component(tree, "ProductYouMayAlsoLike"));
    assert.ok(indexOf("collection_members", "end") < indexOf("collection_peers", "start"));
    const visibilityDecided = indexOf("stock", "end");
    for (const kind of ["flag", "auth"] as Kind[]) {
      assert.ok(indexOf(kind, "start") > visibilityDecided, `${kind} starts after the live visibility check`);
    }
  });

  it("review queries wait for the reviews flag, without holding up related products or the session", async () => {
    cookieJar = [sessionCookie("token-ama", ama)];
    const releaseFlag = hold("flag");
    const rendering = renderPage("silk-dress");

    await waitFor(() => started("flag") === 1, "the reviews flag to start");
    await waitFor(
      () => started("collection_peers") === 1 && started("auth") === 1 && log.filter((e) => e.kind === "stock" && e.phase === "end").length === 1,
      "related products (sharing the single live-stock read) and the session to proceed while the flag is held"
    );
    assert.equal(started("review_aggregate"), 0);
    assert.equal(started("review_list"), 0);

    releaseFlag();
    await rendering;
    assert.ok(indexOf("flag", "end") < indexOf("review_aggregate", "start"));
    assert.ok(indexOf("flag", "end") < indexOf("review_list", "start"));
  });

  it("the product row is read before candidate preparation, and the one live read before any reviews or session work", async () => {
    cookieJar = [sessionCookie("token-ama", ama)];
    await renderPage("silk-dress");
    const productRowRead = indexOf("product", "end");
    for (const kind of ["collection_members", "catalogue", "stock"] as Kind[]) {
      assert.ok(indexOf(kind, "start") > productRowRead, `${kind} starts after the product row is read`);
    }
    assert.equal(started("stock"), 1, "one live read for the product and related candidates");
    const visibilityDecided = indexOf("stock", "end");
    for (const kind of ["flag", "review_aggregate", "review_list", "auth"] as Kind[]) {
      assert.ok(indexOf(kind, "start") > visibilityDecided, `${kind} starts after the live visibility check`);
    }
  });
});

describe("not-found products", () => {
  it("unknown slugs hit not-found without reviews, collection or Auth requests", async () => {
    cookieJar = [sessionCookie("token-ama", ama)];
    await assertNotFound(renderPage("does-not-exist"));
    for (const kind of ["flag", "review_aggregate", "review_list", "collection_members", "auth", "catalogue"] as Kind[]) {
      assert.equal(started(kind), 0, `${kind} is not requested`);
    }
  });

  it("products without variants hit not-found without further requests", async () => {
    cookieJar = [sessionCookie("token-ama", ama)];
    await assertNotFound(renderPage("sample-only"));
    for (const kind of ["flag", "review_aggregate", "review_list", "collection_members", "auth", "catalogue"] as Kind[]) {
      assert.equal(started(kind), 0, `${kind} is not requested`);
    }
  });
});

describe("reviews", () => {
  it("disabled: no review queries, no reviews section, composer or review structured data", async () => {
    db.flags = { reviews: false };
    const tree = await renderPage("silk-dress");
    assert.equal(started("review_aggregate"), 0);
    assert.equal(started("review_list"), 0);
    assert.equal(component(tree, "ProductReviewsSection"), undefined);
    assert.equal(component(tree, "ProductReviewComposer"), undefined);
    assert.equal(reviewSummaryLine(tree), undefined);
    const data = component(tree, "JsonLd")!.props.data as Record<string, unknown>[];
    assert.equal(data[0]!.aggregateRating, undefined);
    assert.equal(data[0]!.review, undefined);
  });

  it("enabled: aggregates and the first page reach the reviews section and structured data", async () => {
    const tree = await renderPage("silk-dress");
    const section = component(tree, "ProductReviewsSection")!;
    assert.deepEqual(section.props.initialAggregates, {
      average: 4.5,
      count: 2,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });
    assert.deepEqual(
      (section.props.initialReviews as { id: string }[]).map((r) => r.id),
      ["r2", "r1"]
    );
    assert.equal(section.props.initialTotal, 2);
    const data = component(tree, "JsonLd")!.props.data as Record<string, unknown>[];
    assert.deepEqual(data[0]!.aggregateRating, {
      "@type": "AggregateRating",
      ratingValue: 4.5,
      reviewCount: 2,
    });
  });

  it("review summary line for zero, one and several reviews", async () => {
    // Published reviews are cached per product, so each count starts from an empty data cache.
    assert.equal(reviewSummaryLine(await renderPage("silk-dress")), "4.5 · 2 reviews");
    db.reviews = db.reviews.slice(0, 1);
    cacheStore.clear();
    assert.equal(reviewSummaryLine(await renderPage("silk-dress")), "5.0 · 1 review");
    db.reviews = [];
    cacheStore.clear();
    assert.equal(reviewSummaryLine(await renderPage("silk-dress")), "Be the first to review this piece.");
  });
});

describe("session", () => {
  it("signed-in visitors can review under their name", async () => {
    cookieJar = [sessionCookie("token-ama", ama)];
    const composer = component(await renderPage("silk-dress"), "ProductReviewComposer")!;
    assert.equal(composer.props.isSignedIn, true);
    assert.equal(composer.props.defaultDisplayName, "Ama Mensah");
    assert.equal(started("auth"), 1);
  });

  it("anonymous visitors get the signed-out composer and no Auth call", async () => {
    const composer = component(await renderPage("silk-dress"), "ProductReviewComposer")!;
    assert.equal(composer.props.isSignedIn, false);
    assert.equal(composer.props.defaultDisplayName, "O & I Clientele");
    assert.equal(started("auth"), 0);
  });
});

describe("live stock", () => {
  it("the variant form and related products use live stock, not the cached catalogue", async () => {
    await renderPage("silk-dress");
    db.products[0]!.variants[0]!.stock = 1;
    db.products[1]!.variants[0]!.stock = 0;
    log.length = 0;

    const tree = await renderPage("silk-dress");
    assert.equal(started("product"), 0, "product served from the data cache");
    assert.equal(started("catalogue"), 0, "catalogue served from the data cache");
    const form = component(tree, "ProductVariantForm")!;
    const product = form.props.product as { variants: { id: string; in_stock: boolean }[] };
    assert.deepEqual(product.variants.map((v) => [v.id, v.in_stock]), [["v1", true]]);
    const related = component(tree, "ProductYouMayAlsoLike")!.props.products as { id: string }[];
    assert.deepEqual(related.map((p) => p.id), ["p4"], "midi dress sold out since the cache was filled");
  });

  it("related products are purchasable only, in rank order", async () => {
    const related = component(await renderPage("silk-dress"), "ProductYouMayAlsoLike")!.props.products as {
      id: string;
    }[];
    assert.deepEqual(related.map((p) => p.id), ["p2", "p4"]);
  });

  it("falls back to fresh database reads when live stock cannot be verified", async () => {
    await renderPage("silk-dress");
    db.failStock = true;
    db.products[1]!.variants[0]!.stock = 0;
    log.length = 0;

    const tree = await renderPage("silk-dress");
    assert.ok(started("product") >= 1, "product reloaded fresh");
    assert.ok(started("catalogue") >= 1, "catalogue reloaded fresh for related products");
    const related = component(tree, "ProductYouMayAlsoLike")!.props.products as { id: string }[];
    assert.deepEqual(related.map((p) => p.id), ["p4"]);
    assert.ok(component(tree, "ProductVariantForm"));
  });
});

describe("error handling", () => {
  it("a reviews flag read failure falls back to the default flags", async () => {
    db.failFlag = true;
    const tree = await renderPage("silk-dress");
    assert.ok(component(tree, "ProductReviewsSection"), "reviews default to enabled");
  });

  it("review query failures give empty review data", async () => {
    db.failReviews = true;
    const tree = await renderPage("silk-dress");
    const section = component(tree, "ProductReviewsSection")!;
    assert.deepEqual(section.props.initialAggregates, {
      average: null,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
    assert.deepEqual(section.props.initialReviews, []);
    assert.equal(section.props.initialTotal, 0);
    assert.equal(reviewSummaryLine(tree), "Be the first to review this piece.");
  });

  it("a missing service-role configuration still fails the page", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await assert.rejects(renderPage("silk-dress"), /Missing Supabase service role configuration/);
  });

  it("a session read failure still fails the page", async () => {
    cookiesThrow = true;
    await assert.rejects(renderPage("silk-dress"), /cookies unavailable/);
  });
});

describe("unchanged output", () => {
  it("every data-carrying prop matches the expected product page", async () => {
    cookieJar = [sessionCookie("token-ama", ama)];
    const tree = await renderPage("silk-dress");

    const tracker = component(tree, "ProductViewTracker")!;
    assert.deepEqual(tracker.props, {
      productId: "p1",
      productName: "Silk Dress",
      categoryName: "Dresses",
      priceGhs: 450,
      size: "M",
      color: "Black",
    });

    const gallery = component(tree, "ProductGallery")!;
    assert.deepEqual(gallery.props, {
      productKey: "p1",
      productSlug: "silk-dress",
      images: ["https://img.test/silk-1.jpg", "https://img.test/silk-2.jpg"],
      name: "Silk Dress",
    });

    assert.deepEqual(component(tree, "BadgeSet")!.props, { badges: ["best_seller"] });

    const formProduct = component(tree, "ProductVariantForm")!.props.product as StorefrontProduct;
    assert.equal(formProduct.id, "p1");
    assert.deepEqual(
      formProduct.variants.map((v) => ({ id: v.id, price: v.price_ghs, in_stock: v.in_stock })),
      [{ id: "v1", price: 450, in_stock: true }]
    );
    assert.equal("stock" in formProduct.variants[0]!, false, "raw stock never reaches the client");

    const reviews = component(tree, "ProductReviewsSection")!;
    assert.equal(reviews.props.productId, "p1");
    const composer = component(tree, "ProductReviewComposer")!;
    assert.deepEqual(composer.props, {
      productId: "p1",
      productSlug: "silk-dress",
      isSignedIn: true,
      defaultDisplayName: "Ama Mensah",
    });

    const listed = reviews.props.initialReviews as Parameters<typeof jsonLd.productJsonLd>[2];
    const data = component(tree, "JsonLd")!.props.data as unknown[];
    assert.equal(data.length, 2);
    assert.deepEqual(
      data[1],
      jsonLd.breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Shop", path: "/shop" },
        { name: "Dresses", path: "/shop/dresses" },
        { name: "Silk Dress", path: "/product/silk-dress" },
      ])
    );
    const productLd = data[0] as Record<string, unknown>;
    assert.equal(productLd.name, "Silk Dress");
    assert.deepEqual(productLd.aggregateRating, { "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 2 });
    assert.equal((productLd.review as unknown[]).length, listed!.length);

    const related = component(tree, "ProductYouMayAlsoLike")!.props.products as { id: string; variants: object[] }[];
    assert.deepEqual(related.map((p) => p.id), ["p2", "p4"]);
    for (const p of related) {
      for (const v of p.variants) assert.equal("stock" in v, false);
    }

    assert.equal(text(elements(tree).find((el) => el.type === "h1")), "Silk Dress");
  });
});
