import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { afterEach, before, beforeEach, describe, it, mock } from "node:test";

/**
 * Public product-page data caching (reviews switch, initial published reviews,
 * collection peers). The product page and the real admin route handlers are
 * called directly. Supabase PostgREST and Auth are a fake global fetch, Next's
 * data cache is an in-memory store that records tags, admin routes run inside a
 * minimal Next work store so their real `revalidateTag` calls are captured and
 * then flushed (as Next does after a response), and `next/headers` is stubbed —
 * no network, no database.
 */

const SUPABASE_URL = "https://unit-test.supabase.co";
const ANON_KEY = "unit-test-anon-key";
const SERVICE_KEY = "unit-test-service-role-key";
const AUTH_COOKIE = "sb-unit-test-auth-token";

type Kind =
  | "product"
  | "catalogue"
  | "stock"
  | "product_categories"
  | "collection_members"
  | "collection_peers"
  | "flag_read"
  | "flag_write"
  | "review_aggregate"
  | "review_list"
  | "review_update"
  | "review_delete"
  | "role"
  | "collections_read"
  | "collections_insert"
  | "auth"
  | "other";

type Call = { kind: Kind; apikey: string | null; bearer: string | null };

type FakeVariant = { id: string; stock: number };
type FakeProduct = {
  id: string;
  slug: string;
  name: string;
  category: { slug: string; name: string };
  occasions: string[];
  variants: FakeVariant[];
};
type FakeReview = {
  id: string;
  product_id: string;
  customer_id: string;
  order_id: string;
  rating: number;
  status: "pending" | "published" | "rejected" | "hidden";
  display_name: string;
  created_at: string;
};

const db = {
  products: [] as FakeProduct[],
  collections: [] as { collection_id: string; product_id: string }[],
  collectionRows: [] as { id: string; title: string; slug: string }[],
  reviews: [] as FakeReview[],
  flags: {} as Record<string, unknown>,
  flagRowHiddenFromAnon: false,
  failFlag: false,
  failReviews: false,
  failCollections: false,
};
const users = new Map<string, { id: string; email: string; role: "admin" | "staff" | null }>();
const calls: Call[] = [];
const cacheStore = new Map<string, { value: unknown; tags: string[] }>();
let cookieJar: { name: string; value: string }[] = [];

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function param(url: URL, name: string, op: string): string | null {
  const value = url.searchParams.get(name);
  return value?.startsWith(`${op}.`) ? value.slice(op.length + 1) : null;
}

function inList(url: URL, name: string): string[] {
  const value = param(url, name, "in");
  if (!value) return [];
  return value
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((s) => s.replace(/^"|"$/g, ""));
}

/** PostgREST answers `.single()` with one object, everything else with an array. */
function rows(headers: Headers, list: unknown[], status = 200): Response {
  if ((headers.get("accept") ?? "").includes("vnd.pgrst.object")) {
    return list.length === 1
      ? json(list[0], status)
      : json({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, 406);
  }
  return json(list, status);
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
    badges: [],
    occasions: p.occasions,
    love_it_points: [],
    rating: null,
    review_count: null,
    categories: p.category,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: `${v.id}-sku`,
      price_ghs: 300,
      compare_at_ghs: null,
      stock: v.stock,
      size: "M",
      color: "Black",
    })),
    product_images: [],
  };
}

function classify(url: URL, method: string): Kind {
  if (url.pathname === "/auth/v1/user") return "auth";
  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select") ?? "";
  switch (table) {
    case "products":
      if (select.startsWith("id,variants(id,stock)")) return "stock";
      return url.searchParams.has("slug") ? "product" : "catalogue";
    case "product_categories":
      return "product_categories";
    case "collection_products":
      return select === "collection_id" ? "collection_members" : "collection_peers";
    case "site_settings":
      return method === "GET" ? "flag_read" : "flag_write";
    case "reviews":
      if (method === "PATCH") return "review_update";
      if (method === "DELETE") return "review_delete";
      return select === "rating" ? "review_aggregate" : "review_list";
    case "superadmins":
    case "admins":
      return "role";
    case "collections":
      return method === "POST" ? "collections_insert" : "collections_read";
    default:
      return "other";
  }
}

function publishedFilter(url: URL) {
  const productId = param(url, "product_id", "eq");
  const status = param(url, "status", "eq");
  return db.reviews.filter((r) => r.product_id === productId && (!status || r.status === status));
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : undefined;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers ?? request?.headers);
  const rawBody = init?.body ?? (request ? await request.text() : undefined);
  const body = typeof rawBody === "string" && rawBody ? JSON.parse(rawBody) : undefined;
  const kind = classify(url, method);
  const authorization = headers.get("authorization") ?? "";
  calls.push({
    kind,
    apikey: headers.get("apikey"),
    bearer: authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null,
  });

  switch (kind) {
    case "auth": {
      const user = users.get(authorization.replace(/^Bearer /, ""));
      if (!user) return json({ code: 401, msg: "invalid JWT" }, 401);
      return json({ id: user.id, email: user.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} });
    }
    case "product": {
      const slug = param(url, "slug", "eq");
      return rows(headers, db.products.filter((p) => p.slug === slug).map(productRow));
    }
    case "catalogue":
      return json(db.products.map(productRow));
    case "stock": {
      const ids = inList(url, "id");
      return json(
        db.products
          .filter((p) => ids.includes(p.id))
          .map((p) => ({ id: p.id, variants: p.variants.map((v) => ({ id: v.id, stock: v.stock })) }))
      );
    }
    case "collection_members": {
      if (db.failCollections) return json({ message: "collections unavailable" }, 503);
      const productId = param(url, "product_id", "eq");
      return json(db.collections.filter((c) => c.product_id === productId).map((c) => ({ collection_id: c.collection_id })));
    }
    case "collection_peers": {
      if (db.failCollections) return json({ message: "collections unavailable" }, 503);
      const ids = inList(url, "collection_id");
      const exclude = param(url, "product_id", "neq");
      return json(
        db.collections
          .filter((c) => ids.includes(c.collection_id) && c.product_id !== exclude)
          .map((c) => ({ product_id: c.product_id }))
      );
    }
    case "flag_read": {
      if (db.failFlag) return json({ message: "settings unavailable" }, 503);
      if (db.flagRowHiddenFromAnon && headers.get("apikey") === ANON_KEY) return rows(headers, []);
      return rows(headers, [{ feature_flags: db.flags }]);
    }
    case "flag_write": {
      db.flags = (body as { feature_flags: Record<string, unknown> }).feature_flags;
      return rows(headers, [{ feature_flags: db.flags }]);
    }
    case "review_aggregate":
      if (db.failReviews) return json({ message: "reviews unavailable" }, 503);
      return json(publishedFilter(url).map((r) => ({ rating: r.rating })));
    case "review_list": {
      if (db.failReviews) return json({ message: "reviews unavailable" }, 503);
      const list = publishedFilter(url)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => ({
          ...r,
          title: null,
          body: `Review ${r.id}`,
          verified_purchase: true,
          purchased_color: null,
          purchased_size: null,
          published_at: r.created_at,
          review_media: [],
        }));
      const range = list.length ? `0-${list.length - 1}/${list.length}` : "*/0";
      return json(list, 200, { "content-range": range });
    }
    case "review_update": {
      const id = param(url, "id", "eq");
      const patch = body as Partial<FakeReview>;
      db.reviews = db.reviews.map((r) => (r.id === id ? { ...r, ...(patch.status ? { status: patch.status } : {}) } : r));
      return new Response(null, { status: 204 });
    }
    case "review_delete": {
      const id = param(url, "id", "eq");
      db.reviews = db.reviews.filter((r) => r.id !== id);
      return new Response(null, { status: 204 });
    }
    case "role": {
      const table = url.pathname.replace("/rest/v1/", "");
      const userId = param(url, "user_id", "eq");
      const user = [...users.values()].find((u) => u.id === userId);
      if (table === "admins" && user?.role) return rows(headers, [{ role: user.role }]);
      return rows(headers, []);
    }
    case "collections_read": {
      const slug = param(url, "slug", "eq");
      return rows(headers, db.collectionRows.filter((c) => c.slug === slug).map((c) => ({ id: c.id })));
    }
    case "collections_insert": {
      const row = { id: `c${db.collectionRows.length + 10}`, ...(body as { title: string; slug: string }) };
      db.collectionRows.push(row);
      return rows(headers, [{ ...row, is_smart: false, created_at: "2026-11-08T00:00:00.000Z" }], 201);
    }
    default:
      return json([]);
  }
}

const fakeIncrementalCache = {
  isOnDemandRevalidate: false,
  async generateCacheKey(key: string) {
    return key;
  },
  async get(key: string) {
    const entry = cacheStore.get(key);
    return entry ? { isStale: false, value: entry.value } : null;
  },
  async set(key: string, value: unknown, ctx?: { tags?: string[] }) {
    cacheStore.set(key, { value, tags: ctx?.tags ?? [] });
  },
};

/** What Next does with a route's pending revalidated tags once the response is sent. */
function flushTags(tags: string[]): void {
  for (const [key, entry] of cacheStore) {
    if (entry.tags.some((t) => tags.includes(t))) cacheStore.delete(key);
  }
}

function cacheKeys(name: string): string[] {
  return [...cacheStore.keys()].filter((k) => k.includes(name));
}

function sessionCookie(token: string) {
  const user = users.get(token)!;
  const session = {
    access_token: token,
    refresh_token: `${token}-refresh`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: user.id, email: user.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
  return { name: AUTH_COOKIE, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` };
}

function signIn(token: string | null) {
  cookieJar = token ? [sessionCookie(token)] : [];
}

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
const headersPath = requireFromRoot.resolve("next/headers");
const headersModule = new Module(headersPath);
headersModule.filename = headersPath;
headersModule.exports = {
  async cookies() {
    const jar = cookieJar;
    return {
      getAll: () => jar.map((c) => ({ ...c })),
      get: (name: string) => jar.find((c) => c.name === name),
      set: () => {},
    };
  },
  async headers() {
    return new Headers();
  },
};
headersModule.loaded = true;
requireFromRoot.cache[headersPath] = headersModule;

type RouteHandler = (request: Request) => Promise<Response>;
type WorkStore = { run<T>(store: Record<string, unknown>, fn: () => T): T };
type Element = { type: unknown; props: Record<string, unknown>; key?: unknown };

let workAsyncStorage: WorkStore;
let page: typeof import("../app/(store)/product/[slug]/page");
let moderationRoute: typeof import("../app/api/admin/reviews/route");
let visibilityRoute: typeof import("../app/api/admin/reviews/visibility/route");
let featureFlagsRoute: typeof import("../app/api/admin/feature-flags/route");
let collectionsRoute: typeof import("../app/api/admin/collections/route");
let publicReviewsRoute: typeof import("../app/api/reviews/route");

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;
  workAsyncStorage = (
    requireFromRoot("next/dist/server/app-render/work-async-storage.external") as { workAsyncStorage: WorkStore }
  ).workAsyncStorage;
  page = await import("../app/(store)/product/[slug]/page");
  moderationRoute = await import("../app/api/admin/reviews/route");
  visibilityRoute = await import("../app/api/admin/reviews/visibility/route");
  featureFlagsRoute = await import("../app/api/admin/feature-flags/route");
  collectionsRoute = await import("../app/api/admin/collections/route");
  publicReviewsRoute = await import("../app/api/reviews/route");
});

beforeEach(() => {
  const product = (id: string, slug: string, name: string, category: string, occasions: string[], stock: number) => ({
    id,
    slug,
    name,
    category: { slug: category, name: category[0]!.toUpperCase() + category.slice(1) },
    occasions,
    variants: [{ id: `v-${id}`, stock }],
  });
  db.products = [
    product("p1", "silk-dress", "Silk Dress", "dresses", ["wedding"], 5),
    product("p2", "midi-dress", "Midi Dress", "dresses", [], 3),
    product("p3", "linen-top", "Linen Top", "tops", ["wedding"], 2),
    product("p4", "satin-skirt", "Satin Skirt", "bottoms", [], 4),
    product("p6", "wrap-top", "Wrap Top", "tops", [], 6),
  ];
  db.collections = [
    { collection_id: "c1", product_id: "p1" },
    { collection_id: "c1", product_id: "p4" },
  ];
  db.collectionRows = [{ id: "c1", title: "Occasion edit", slug: "occasion-edit" }];
  const review = (id: string, productId: string, rating: number, status: FakeReview["status"], day: number): FakeReview => ({
    id,
    product_id: productId,
    customer_id: `customer-${id}`,
    order_id: `order-${id}`,
    rating,
    status,
    display_name: `Client ${id}`,
    created_at: `2026-10-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  });
  db.reviews = [
    review("r1", "p1", 5, "published", 1),
    review("r2", "p1", 4, "published", 5),
    review("r3", "p1", 3, "pending", 6),
    review("r4", "p1", 1, "hidden", 7),
    review("r5", "p1", 2, "rejected", 8),
    review("r6", "p6", 5, "published", 2),
  ];
  db.flags = { reviews: true };
  db.flagRowHiddenFromAnon = false;
  db.failFlag = false;
  db.failReviews = false;
  db.failCollections = false;
  users.clear();
  users.set("token-admin", { id: "user-admin", email: "admin@example.test", role: "admin" });
  users.set("token-staff", { id: "user-staff", email: "staff@example.test", role: "staff" });
  users.set("token-customer", { id: "user-customer", email: "customer@example.test", role: null });
  calls.length = 0;
  cacheStore.clear();
  cookieJar = [];
});

afterEach(() => {
  mock.timers.reset();
});

function count(kind: Kind): number {
  return calls.filter((c) => c.kind === kind).length;
}

function renderPage(slug = "silk-dress") {
  return page.default({ params: Promise.resolve({ slug }) }) as Promise<unknown>;
}

function isElement(node: unknown): node is Element {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

function elements(node: unknown, out: Element[] = []): Element[] {
  if (Array.isArray(node)) for (const child of node) elements(child, out);
  else if (isElement(node)) {
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

function reviewSummary(tree: unknown): string | undefined {
  return elements(tree)
    .filter((el) => el.type === "p")
    .map((el) => text(el))
    .find((t) => /review/i.test(t));
}

function listedReviewIds(tree: unknown): string[] | null {
  const section = component(tree, "ProductReviewsSection");
  return section ? (section.props.initialReviews as { id: string }[]).map((r) => r.id) : null;
}

function relatedIds(tree: unknown): string[] {
  return (component(tree, "ProductYouMayAlsoLike")!.props.products as { id: string }[]).map((p) => p.id);
}

/**
 * Element tree as plain data. Keys holding `undefined` are dropped: data-cache
 * entries are JSON, so a cached product has no `compare_at_ghs` key where a fresh
 * one has `compare_at_ghs: undefined` — React renders both identically.
 */
function normalise(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalise);
  if (typeof node === "function") return `[fn ${node.name}]`;
  if (isElement(node)) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.props)) if (v !== undefined) props[k] = normalise(v);
    return { type: typeName(node), key: node.key ?? null, props };
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) if (v !== undefined) out[k] = normalise(v);
    return out;
  }
  return node;
}

/** Runs a real route handler inside a Next work store, then flushes the tags it expired. */
async function callRoute(
  handler: RouteHandler,
  url: string,
  method: string,
  body: unknown
): Promise<{ status: number; expired: string[] }> {
  const store: Record<string, unknown> = {
    incrementalCache: fakeIncrementalCache,
    route: new URL(url).pathname,
    page: `${new URL(url).pathname}/route`,
  };
  const response = await workAsyncStorage.run(store, () =>
    handler(
      new Request(url, {
        method,
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    )
  );
  const pending = (store.pendingRevalidatedTags ?? []) as { tag: string; profile: unknown }[];
  for (const p of pending) assert.deepEqual(p.profile, { expire: 0 }, "tags expire immediately");
  const expired = pending.map((p) => p.tag);
  flushTags(expired);
  return { status: response.status, expired };
}

const TAGS = {
  products: "public-catalogue:products",
  reviews: "public-catalogue:reviews",
  collections: "public-catalogue:collections",
  featureFlags: "public-site-settings:feature-flags",
};

describe("cache hits and keys", () => {
  it("a warm product page reads no reviews switch, reviews or collections, but still reads live stock", async () => {
    signIn("token-customer");
    await renderPage();
    calls.length = 0;
    await renderPage();
    for (const kind of ["flag_read", "review_aggregate", "review_list", "collection_members", "collection_peers"] as Kind[]) {
      assert.equal(count(kind), 0, `${kind} served from the data cache`);
    }
    assert.equal(count("stock"), 1, "product and related-product stock are still read live, in one request");
  });

  it("each product has its own reviews and collection entries; the reviews switch is shared", async () => {
    await renderPage("silk-dress");
    calls.length = 0;
    const tree = await renderPage("wrap-top");
    assert.equal(count("flag_read"), 0);
    assert.equal(count("review_aggregate"), 1);
    assert.equal(count("review_list"), 1);
    assert.equal(count("collection_members"), 1);
    assert.deepEqual(listedReviewIds(tree), ["r6"]);
    assert.equal(cacheKeys("product-reviews-initial").length, 2);
    assert.equal(cacheKeys("collection-peers").length, 2);
    assert.equal(cacheKeys("storefront-reviews-enabled").length, 1);
  });

  it("unknown products create no reviews, collection or switch entries", async () => {
    await assert.rejects(renderPage("no-such-product"), (e: unknown) => /404/.test(String((e as { digest?: unknown }).digest)));
    assert.equal(cacheKeys("product-reviews-initial").length, 0);
    assert.equal(cacheKeys("collection-peers").length, 0);
    assert.equal(cacheKeys("storefront-reviews-enabled").length, 0);
  });

  it("cache entries carry the approved tags", async () => {
    await renderPage();
    const tagsOf = (name: string) => cacheStore.get(cacheKeys(name)[0]!)!.tags;
    assert.deepEqual(tagsOf("product-reviews-initial"), [TAGS.reviews]);
    assert.deepEqual(tagsOf("storefront-reviews-enabled"), [TAGS.featureFlags]);
    assert.deepEqual(tagsOf("collection-peers"), [TAGS.collections, TAGS.products]);
  });
});

describe("published reviews only", () => {
  it("pending, hidden and rejected reviews are never shown or cached", async () => {
    const tree = await renderPage();
    assert.deepEqual(listedReviewIds(tree), ["r2", "r1"]);
    assert.equal(reviewSummary(tree), "4.5 · 2 reviews");
    const cached = JSON.stringify(cacheStore.get(cacheKeys("product-reviews-initial")[0]!)!.value);
    for (const id of ["r3", "r4", "r5"]) assert.doesNotMatch(cached, new RegExp(`Review ${id}\\b`));
  });

  it("the cached entry holds only public review fields", async () => {
    await renderPage();
    const cached = JSON.stringify(cacheStore.get(cacheKeys("product-reviews-initial")[0]!)!.value);
    assert.doesNotMatch(cached, /customer_id|customer-r|order_id|order-r|@example/);
  });
});

describe("strict loaders: failures are never cached", () => {
  it("a reviews query failure shows the existing empty state and is retried next time", async () => {
    db.failReviews = true;
    const failed = await renderPage();
    assert.deepEqual(listedReviewIds(failed), []);
    assert.equal(reviewSummary(failed), "Be the first to review this piece.");
    assert.equal(cacheKeys("product-reviews-initial").length, 0);

    db.failReviews = false;
    const recovered = await renderPage();
    assert.deepEqual(listedReviewIds(recovered), ["r2", "r1"]);
  });

  it("a reviews switch read failure uses the existing defaults and is retried next time", async () => {
    db.failFlag = true;
    const failed = await renderPage();
    assert.ok(component(failed, "ProductReviewsSection"), "default flags keep reviews on");
    assert.equal(cacheKeys("storefront-reviews-enabled").length, 0);

    db.failFlag = false;
    db.flags = { reviews: false };
    const recovered = await renderPage();
    assert.equal(component(recovered, "ProductReviewsSection"), undefined, "the fallback default was not cached");
  });

  it("a settings row the public client cannot see falls back to the authoritative read and is not cached", async () => {
    db.flagRowHiddenFromAnon = true;
    db.flags = { reviews: false };
    const tree = await renderPage();
    assert.equal(component(tree, "ProductReviewsSection"), undefined);
    assert.equal(cacheKeys("storefront-reviews-enabled").length, 0);
    const reads = calls.filter((c) => c.kind === "flag_read").map((c) => c.apikey);
    assert.deepEqual(reads, [ANON_KEY, SERVICE_KEY]);
  });

  it("a collection query failure drops the collection boost and is retried next time", async () => {
    db.failCollections = true;
    const failed = await renderPage();
    assert.deepEqual(relatedIds(failed), ["p2", "p3", "p4", "p6"]);
    assert.equal(cacheKeys("collection-peers").length, 0);

    db.failCollections = false;
    const recovered = await renderPage();
    assert.deepEqual(relatedIds(recovered), ["p4", "p2", "p3", "p6"]);
  });
});

describe("reviews switch", () => {
  it("switching reviews off stops every review query on the product page", async () => {
    db.flags = { reviews: false };
    const tree = await renderPage();
    assert.equal(count("review_aggregate"), 0);
    assert.equal(count("review_list"), 0);
    assert.equal(component(tree, "ProductReviewsSection"), undefined);
    assert.equal(component(tree, "ProductReviewComposer"), undefined);
    assert.equal(cacheKeys("product-reviews-initial").length, 0);
  });

  it("the reviews API, submission, eligibility and admin pages keep the uncached switch", () => {
    for (const file of [
      "app/api/reviews/route.ts",
      "app/api/reviews/eligible/route.ts",
      "app/admin/reviews/page.tsx",
      "app/admin/feature-flags/page.tsx",
      "app/superadmin/reviews/page.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      assert.match(source, /isReviewsFeatureEnabled/, file);
      assert.doesNotMatch(source, /reviews\/public-cache|getStorefrontReviewsEnabled|unstable_cache/, file);
    }
    for (const file of ["lib/reviews/submit.ts", "lib/reviews/eligibility.ts", "lib/reviews/feature.ts"]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /public-cache|unstable_cache|publicCacheKeyParts/, file);
    }
  });

  it("the reviews API reads reviews and the switch fresh on every request", async () => {
    await renderPage();
    calls.length = 0;
    for (let i = 0; i < 2; i++) {
      const res = await publicReviewsRoute.GET(new Request(`http://localhost/api/reviews?productId=p1&x=${i}`));
      const body = (await res.json()) as { reviews: { id: string }[] };
      assert.deepEqual(body.reviews.map((r) => r.id), ["r2", "r1"]);
    }
    assert.equal(count("review_list"), 2);
    assert.equal(count("review_aggregate"), 2);
    assert.deepEqual(calls.filter((c) => c.kind === "flag_read").map((c) => c.apikey), [SERVICE_KEY, SERVICE_KEY]);
  });
});

describe("admin invalidation: PATCH /api/admin/reviews", () => {
  const url = "http://localhost/api/admin/reviews";

  it("hiding a published review removes it from the next product page", async () => {
    signIn("token-admin");
    await renderPage();
    const result = await callRoute(moderationRoute.PATCH, url, "PATCH", { reviewId: "r1", status: "hidden" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.expired.sort(), [TAGS.products, TAGS.reviews].sort());
    const tree = await renderPage();
    assert.deepEqual(listedReviewIds(tree), ["r2"]);
    assert.equal(reviewSummary(tree), "4.0 · 1 review");
  });

  it("publishing a pending review adds it to the next product page", async () => {
    signIn("token-staff");
    await renderPage();
    const result = await callRoute(moderationRoute.PATCH, url, "PATCH", { reviewId: "r3", status: "published" });
    assert.equal(result.status, 200);
    const tree = await renderPage();
    assert.deepEqual(listedReviewIds(tree), ["r3", "r2", "r1"]);
    assert.equal(reviewSummary(tree), "4.0 · 3 reviews");
  });

  it("deleting a review removes it from the next product page", async () => {
    signIn("token-admin");
    await renderPage();
    const result = await callRoute(moderationRoute.PATCH, url, "PATCH", { reviewId: "r2", delete: true });
    assert.equal(result.status, 200);
    assert.deepEqual(listedReviewIds(await renderPage()), ["r1"]);
  });

  it("anonymous visitors and customers get 403 and expire nothing", async () => {
    await renderPage();
    for (const token of [null, "token-customer"]) {
      signIn(token);
      const result = await callRoute(moderationRoute.PATCH, url, "PATCH", { reviewId: "r1", status: "hidden" });
      assert.equal(result.status, 403);
      assert.deepEqual(result.expired, []);
    }
    assert.equal(db.reviews.find((r) => r.id === "r1")!.status, "published");
    assert.equal(cacheKeys("product-reviews-initial").length, 1, "cached reviews kept");
  });

  it("a rejected request body still expires the tags (no write, harmless)", async () => {
    signIn("token-admin");
    const result = await callRoute(moderationRoute.PATCH, url, "PATCH", { status: "hidden" });
    assert.equal(result.status, 400);
    assert.deepEqual(result.expired.sort(), [TAGS.products, TAGS.reviews].sort());
  });
});

describe("admin invalidation: PATCH /api/admin/reviews/visibility", () => {
  const url = "http://localhost/api/admin/reviews/visibility";

  it("switching reviews off hides reviews on the next product page and stops review queries", async () => {
    signIn("token-admin");
    await renderPage();
    const result = await callRoute(visibilityRoute.PATCH, url, "PATCH", { enabled: false });
    assert.equal(result.status, 200);
    assert.deepEqual(result.expired, [TAGS.featureFlags]);
    calls.length = 0;
    const tree = await renderPage();
    assert.equal(component(tree, "ProductReviewsSection"), undefined);
    assert.equal(count("review_aggregate") + count("review_list"), 0);
  });

  it("switching reviews back on shows them on the next product page", async () => {
    signIn("token-admin");
    db.flags = { reviews: false };
    await renderPage();
    const result = await callRoute(visibilityRoute.PATCH, url, "PATCH", { enabled: true });
    assert.equal(result.status, 200);
    assert.deepEqual(listedReviewIds(await renderPage()), ["r2", "r1"]);
  });

  it("staff, customers and anonymous visitors get 403 and expire nothing", async () => {
    await renderPage();
    for (const token of [null, "token-customer", "token-staff"]) {
      signIn(token);
      const result = await callRoute(visibilityRoute.PATCH, url, "PATCH", { enabled: false });
      assert.equal(result.status, 403);
      assert.deepEqual(result.expired, []);
    }
    assert.equal(db.flags.reviews, true);
    assert.equal(cacheKeys("storefront-reviews-enabled").length, 1);
  });

  it("an invalid body is rejected without writing", async () => {
    signIn("token-admin");
    const result = await callRoute(visibilityRoute.PATCH, url, "PATCH", { enabled: "no" });
    assert.equal(result.status, 400);
    assert.equal(db.flags.reviews, true);
    assert.equal(count("flag_write"), 0);
  });
});

describe("admin invalidation: PATCH /api/admin/feature-flags", () => {
  const url = "http://localhost/api/admin/feature-flags";

  it("turning reviews off in the flags JSON hides reviews on the next product page", async () => {
    signIn("token-admin");
    await renderPage();
    const result = await callRoute(featureFlagsRoute.PATCH, url, "PATCH", { featureFlags: { reviews: false } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.expired, [TAGS.featureFlags]);
    assert.equal(component(await renderPage(), "ProductReviewsSection"), undefined);
  });

  it("staff and anonymous visitors get 403 and expire nothing", async () => {
    for (const token of [null, "token-staff"]) {
      signIn(token);
      const result = await callRoute(featureFlagsRoute.PATCH, url, "PATCH", { featureFlags: { reviews: false } });
      assert.equal(result.status, 403);
      assert.deepEqual(result.expired, []);
    }
    assert.equal(db.flags.reviews, true);
  });
});

describe("admin invalidation: POST /api/admin/collections", () => {
  const url = "http://localhost/api/admin/collections";

  it("creating a collection expires collection peers", async () => {
    signIn("token-admin");
    await renderPage();
    db.collections.push({ collection_id: "c1", product_id: "p6" });
    const result = await callRoute(collectionsRoute.POST, url, "POST", { title: "Wedding edit" });
    assert.equal(result.status, 201);
    assert.deepEqual(result.expired, [TAGS.collections]);
    assert.deepEqual(relatedIds(await renderPage()), ["p4", "p6", "p2", "p3"]);
  });

  it("a duplicate slug is rejected (409) and still expires the tag harmlessly", async () => {
    signIn("token-admin");
    const result = await callRoute(collectionsRoute.POST, url, "POST", { title: "Occasion edit" });
    assert.equal(result.status, 409);
    assert.deepEqual(result.expired, [TAGS.collections]);
  });

  it("anonymous visitors and customers get 403 and expire nothing", async () => {
    await renderPage();
    for (const token of [null, "token-customer"]) {
      signIn(token);
      const result = await callRoute(collectionsRoute.POST, url, "POST", { title: "Sneaky" });
      assert.equal(result.status, 403);
      assert.deepEqual(result.expired, []);
    }
    assert.equal(cacheKeys("collection-peers").length, 1);
  });

  it("product admin saves (products tag) also refresh collection peers", async () => {
    await renderPage();
    db.collections.push({ collection_id: "c1", product_id: "p6" });
    flushTags([TAGS.products]);
    assert.deepEqual(relatedIds(await renderPage()), ["p4", "p6", "p2", "p3"]);
  });
});

describe("external database changes are bounded by the time windows", () => {
  const WINDOW_START = 1_800_000_000_000 - (1_800_000_000_000 % 300_000) + 1_000;

  it("published reviews: unchanged within 300 seconds, refreshed after", async () => {
    mock.timers.enable({ apis: ["Date"], now: WINDOW_START });
    await renderPage();
    db.reviews = db.reviews.map((r) => (r.id === "r1" ? { ...r, status: "hidden" } : r));
    mock.timers.tick(298_000);
    assert.deepEqual(listedReviewIds(await renderPage()), ["r2", "r1"]);
    mock.timers.tick(2_000);
    assert.deepEqual(listedReviewIds(await renderPage()), ["r2"]);
  });

  it("reviews switch: unchanged within 60 seconds, refreshed after", async () => {
    mock.timers.enable({ apis: ["Date"], now: WINDOW_START });
    await renderPage();
    db.flags = { reviews: false };
    mock.timers.tick(58_000);
    assert.ok(component(await renderPage(), "ProductReviewsSection"));
    mock.timers.tick(2_000);
    assert.equal(component(await renderPage(), "ProductReviewsSection"), undefined);
  });

  it("collection peers: unchanged within 300 seconds, refreshed after", async () => {
    mock.timers.enable({ apis: ["Date"], now: WINDOW_START });
    await renderPage();
    db.collections = [];
    mock.timers.tick(298_000);
    assert.deepEqual(relatedIds(await renderPage()), ["p4", "p2", "p3", "p6"]);
    mock.timers.tick(2_000);
    assert.deepEqual(relatedIds(await renderPage()), ["p2", "p3", "p4", "p6"]);
  });
});

describe("related products", () => {
  it("cached collection peers boost ranking but live stock still filters sold-out items", async () => {
    await renderPage();
    db.products.find((p) => p.id === "p4")!.variants[0]!.stock = 0;
    calls.length = 0;
    const tree = await renderPage();
    assert.equal(count("collection_members"), 0, "peers from the cache");
    assert.deepEqual(relatedIds(tree), ["p2", "p3", "p6"], "sold-out peer removed by the live stock read");
  });

  it("the cached collection read uses the public client, never the visitor's session", async () => {
    signIn("token-customer");
    await renderPage();
    const collectionCalls = calls.filter((c) => c.kind === "collection_members" || c.kind === "collection_peers");
    assert.ok(collectionCalls.length >= 1);
    for (const c of collectionCalls) {
      assert.equal(c.apikey, ANON_KEY);
      assert.equal(c.bearer, ANON_KEY);
    }
  });

  it("live stock is never wrapped in the data cache", () => {
    const related = readFileSync("lib/data/related-products.ts", "utf8");
    assert.doesNotMatch(related, /unstable_cache\(\s*[^)]*loadLiveAvailability/);
    const cached = related.slice(related.indexOf("const getCachedCollectionPeerIds"), related.indexOf("async function getCollectionPeerIds"));
    assert.doesNotMatch(cached, /loadLiveAvailability|stock/);
  });
});

describe("unchanged product page output", () => {
  const scenarios: [string, () => void][] = [
    ["signed-in customer, reviews on", () => signIn("token-customer")],
    ["anonymous, reviews off", () => (db.flags = { reviews: false })],
    ["no reviews", () => (db.reviews = [])],
  ];

  for (const [name, setup] of scenarios) {
    it(`cached and uncached renders are identical: ${name}`, async () => {
      setup();
      const uncachedCache = {
        ...fakeIncrementalCache,
        async get() {
          return null;
        },
        async set() {},
      };
      const g = globalThis as unknown as { __incrementalCache: unknown };
      g.__incrementalCache = uncachedCache;
      let uncached: unknown;
      try {
        uncached = normalise(await renderPage());
      } finally {
        g.__incrementalCache = fakeIncrementalCache;
      }
      const cold = normalise(await renderPage());
      const warm = normalise(await renderPage());
      assert.deepEqual(cold, uncached);
      assert.deepEqual(warm, uncached);
    });
  }
});

describe("source contracts", () => {
  it("cache windows and tags match the approved design", () => {
    const cacheModule = readFileSync("lib/cache/public-catalogue.ts", "utf8");
    assert.match(cacheModule, /reviews: "public-catalogue:reviews"/);
    assert.match(cacheModule, /collections: "public-catalogue:collections"/);
    assert.match(cacheModule, /featureFlags: "public-site-settings:feature-flags"/);
    assert.match(cacheModule, /export const FEATURE_FLAGS_CACHE_SECONDS = 60;/);
    const reviewsCache = readFileSync("lib/reviews/public-cache.ts", "utf8");
    assert.match(reviewsCache, /revalidate: FEATURE_FLAGS_CACHE_SECONDS, tags: \[PUBLIC_CACHE_TAGS\.featureFlags\]/);
    assert.match(reviewsCache, /revalidate: PUBLIC_CATALOGUE_REVALIDATE_SECONDS, tags: \[PUBLIC_CACHE_TAGS\.reviews\]/);
    assert.match(reviewsCache, /\{ strict: true \}\)[\s\S]*\{ strict: true \}\)/);
  });

  it("the four admin routes are wrapped with the right tags", () => {
    const expectations: [string, RegExp][] = [
      ["app/api/admin/reviews/route.ts", /export const PATCH = withPublicCacheExpiry\(moderateReviewRequest, REVIEW_CACHE_TAGS\);/],
      [
        "app/api/admin/reviews/visibility/route.ts",
        /export const PATCH = withPublicCacheExpiry\(updateReviewsVisibility, \[PUBLIC_CACHE_TAGS\.featureFlags\]\);/,
      ],
      [
        "app/api/admin/feature-flags/route.ts",
        /export const PATCH = withPublicCacheExpiry\(updateFeatureFlags, \[PUBLIC_CACHE_TAGS\.featureFlags\]\);/,
      ],
      ["app/api/admin/collections/route.ts", /export const POST = withPublicCacheExpiry\(createCollection, \[PUBLIC_CACHE_TAGS\.collections\]\);/],
    ];
    for (const [file, pattern] of expectations) assert.match(readFileSync(file, "utf8"), pattern, file);
  });
});
