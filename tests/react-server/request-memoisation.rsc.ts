import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { PassThrough } from "node:stream";
import { before, beforeEach, describe, it } from "node:test";

/**
 * Runs under `node --conditions=react-server` (launched by
 * tests/request-memoisation.test.ts). Each simulated request is a real React
 * Flight render (`renderToPipeableStream` from the renderer bundled with Next),
 * so `cache()` uses Flight's own per-render cache. `react`/`react-dom` resolve
 * to Next's bundled copies, as in Next's runtime, so the app modules and the
 * renderer share one React instance. Supabase (PostgREST + Auth) is a fake
 * global fetch, Next's data cache is in memory and `next/headers` is stubbed —
 * no network, no database.
 */

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));

const nextCompiled = path.join(path.dirname(requireFromRoot.resolve("next/package.json")), "dist", "compiled");
const reactAliases: Record<string, string> = {
  react: path.join(nextCompiled, "react", "react.react-server.js"),
  "next/dist/compiled/react": path.join(nextCompiled, "react", "react.react-server.js"),
  "react/jsx-runtime": path.join(nextCompiled, "react", "jsx-runtime.react-server.js"),
  "react-dom": path.join(nextCompiled, "react-dom", "react-dom.react-server.js"),
};
const resolver = Module as unknown as { _resolveFilename(this: unknown, request: string, ...rest: unknown[]): string };
const originalResolveFilename = resolver._resolveFilename;
resolver._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  return reactAliases[request] ?? originalResolveFilename.call(this, request, ...rest);
};

type Cookie = { name: string; value: string };
const requestCookies = new AsyncLocalStorage<Cookie[]>();

const fakeHeaders = {
  async cookies() {
    const jar = requestCookies.getStore() ?? [];
    return {
      getAll: () => jar.map((c) => ({ ...c })),
      get: (name: string) => jar.find((c) => c.name === name),
      set: () => {},
    };
  },
};

const headersPath = requireFromRoot.resolve("next/headers");
const headersModule = new Module(headersPath);
headersModule.filename = headersPath;
headersModule.exports = fakeHeaders;
headersModule.loaded = true;
requireFromRoot.cache[headersPath] = headersModule;

type ReactServer = typeof import("react") & { useState?: unknown };
const React = requireFromRoot("react") as ReactServer;
type Flight = {
  renderToPipeableStream(
    model: unknown,
    webpackMap: unknown,
    options?: { onError?: (error: unknown) => void }
  ): { pipe<T extends NodeJS.WritableStream>(destination: T): T };
};
const flight = requireFromRoot("next/dist/compiled/react-server-dom-webpack/server.node") as Flight;

/** One request = one complete Flight render of `element`, with the given cookies. */
function renderRequest(cookies: Cookie[], element: unknown): Promise<void> {
  return requestCookies.run(
    cookies,
    () =>
      new Promise<void>((resolve, reject) => {
        const sink = new PassThrough();
        sink.on("data", () => {});
        sink.on("end", resolve);
        sink.on("error", reject);
        flight.renderToPipeableStream(element, {}, { onError: reject }).pipe(sink);
      })
  );
}

/** Runs `fn` inside a server component of its own Flight render. */
async function runRequest<T>(cookies: Cookie[], fn: () => Promise<T>): Promise<T> {
  let result: { value: T } | undefined;
  async function Root() {
    result = { value: await fn() };
    return null;
  }
  await renderRequest(cookies, React.createElement(Root));
  assert.ok(result, "the server component rendered");
  return result.value;
}

const SUPABASE_URL = "https://unit-test.supabase.co";
const AUTH_COOKIE = "sb-unit-test-auth-token";

const db = {
  homeSections: {} as Record<string, unknown>,
  homeUpdatedAt: "2026-11-01T00:00:00.000Z",
  categories: [] as { slug: string; name: string; description: string | null; image_url: string | null }[],
};
const users = new Map<string, { id: string; email: string; user_metadata: Record<string, unknown> }>();
const calls = { auth: [] as string[], home: 0, categories: 0, other: [] as string[] };
const dataCacheReads = { home: 0, categories: 0 };
const cacheStore = new Map<string, unknown>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function bearer(init?: RequestInit, input?: Request): string | null {
  const headers = new Headers(init?.headers ?? input?.headers);
  const auth = headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : undefined;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

  if (url.pathname === "/auth/v1/user") {
    const token = bearer(init, request);
    calls.auth.push(token ?? "");
    const user = token ? users.get(token) : undefined;
    if (!user) return json({ code: 401, msg: "invalid JWT" }, 401);
    return json({ ...user, aud: "authenticated", role: "authenticated", app_metadata: {} });
  }

  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "home_content") {
    calls.home++;
    return json({ sections: db.homeSections, updated_at: db.homeUpdatedAt });
  }
  if (table === "categories") {
    calls.categories++;
    assert.equal(url.searchParams.get("order"), "sort_order.asc");
    return json(db.categories);
  }
  calls.other.push(url.pathname);
  return json([]);
}

const fakeIncrementalCache = {
  isOnDemandRevalidate: false,
  async generateCacheKey(key: string) {
    return key;
  },
  async get(key: string) {
    if (key.includes("home-content")) dataCacheReads.home++;
    if (key.includes("categories")) dataCacheReads.categories++;
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

type HomeContentModule = typeof import("../../lib/data/home-content");
type HomepageCmsDataModule = typeof import("../../lib/data/homepage-cms");
type HomepageCmsModule = typeof import("../../lib/home/homepage-cms");
type CatalogModule = typeof import("../../lib/data/catalog");
type AccountModule = typeof import("../../lib/data/account-orders");
let homeContent: HomeContentModule;
let homepageCmsData: HomepageCmsDataModule;
let homepageCms: HomepageCmsModule;
let catalog: CatalogModule;
let account: AccountModule;

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;
  homeContent = await import("../../lib/data/home-content");
  homepageCmsData = await import("../../lib/data/homepage-cms");
  homepageCms = await import("../../lib/home/homepage-cms");
  catalog = await import("../../lib/data/catalog");
  account = await import("../../lib/data/account-orders");
});

beforeEach(() => {
  db.homeSections = {
    footer: { tagline: "Crafted in Accra" },
    homepage_sections: { best_sellers_title: "Most loved" },
  };
  db.homeUpdatedAt = "2026-11-01T00:00:00.000Z";
  db.categories = [
    { slug: "dresses", name: "Dresses", description: null, image_url: null },
    { slug: "tops", name: "Tops", description: "Easy tops", image_url: null },
  ];
  users.clear();
  users.set("token-ama", { id: "user-ama", email: "Ama@Example.test", user_metadata: { full_name: "Ama" } });
  users.set("token-kofi", { id: "user-kofi", email: "kofi@example.test", user_metadata: {} });
  calls.auth.length = 0;
  calls.home = 0;
  calls.categories = 0;
  calls.other.length = 0;
  dataCacheReads.home = 0;
  dataCacheReads.categories = 0;
  cacheStore.clear();
});

describe("test harness", () => {
  it("renders with React Flight against React's server build", () => {
    assert.equal(React.useState, undefined, "server build of React");
    assert.equal(requireFromRoot("react"), requireFromRoot(reactAliases.react!), "Next's bundled React");
    assert.equal(typeof flight.renderToPipeableStream, "function");
  });

  it("cache() memoises within a Flight render and not outside one", async () => {
    let calls = 0;
    const probe = React.cache(async () => ({ call: ++calls }));
    const outside = [await probe(), await probe()];
    assert.notEqual(outside[0], outside[1]);
    const inside = await runRequest([], async () => [await probe(), await probe()]);
    assert.equal(inside[0], inside[1]);
    const nextRender = await runRequest([], async () => probe());
    assert.notEqual(nextRender, inside[0]);
  });
});

/** The homepage's calls, in the shape the layout, metadata and page make them. */
async function homepageRequestReads() {
  const layoutCms = await homepageCmsData.getHomepageCms();
  const metadata = await Promise.all([homeContent.getHomeContentRow(), homepageCmsData.getHomepageCms()]);
  const page = await Promise.all([homeContent.getHomeContentSections(), homepageCmsData.getHomepageCms()]);
  return { layoutCms, metadataRow: metadata[0], metadataCms: metadata[1], pageSections: page[0], pageCms: page[1] };
}

describe("homepage content (C1)", () => {
  it("before: without a request scope the previous call pattern read the data cache four times", async () => {
    await homepageCmsData.getHomepageCms();
    await homeContent.getHomeContentRow();
    await Promise.all([homeContent.getHomeContentSections(), homepageCmsData.getHomepageCms()]);
    assert.equal(dataCacheReads.home, 4);
  });

  it("one data-cache read and one parse per homepage request", async () => {
    const reads = await runRequest([], homepageRequestReads);
    assert.equal(dataCacheReads.home, 1);
    assert.equal(calls.home, 1, "cold cache: one database read fills it");
    assert.equal(reads.layoutCms, reads.metadataCms, "layout and metadata share one parsed CMS object");
    assert.equal(reads.layoutCms, reads.pageCms, "layout and page share one parsed CMS object");
    assert.equal(reads.pageSections, reads.metadataRow.sections);
  });

  it("output is unchanged: same sections, timestamp and parsed CMS as before", async () => {
    const reads = await runRequest([], homepageRequestReads);
    assert.deepEqual(reads.pageSections, db.homeSections);
    assert.equal(reads.metadataRow.updatedAt, db.homeUpdatedAt);
    assert.deepEqual(reads.layoutCms, homepageCms.parseHomepageCms(db.homeSections));
  });

  it("the public data cache still serves later requests; memoisation ends with the request", async () => {
    await runRequest([], homepageRequestReads);
    await runRequest([], homepageRequestReads);
    assert.equal(calls.home, 1, "second request is served by the data cache, not the database");
    assert.equal(dataCacheReads.home, 2, "each request does its own data-cache read");
  });

  it("an invalidated data cache is picked up by the next request", async () => {
    const first = await runRequest([], homepageRequestReads);
    db.homeSections = { footer: { tagline: "New season" } };
    cacheStore.clear();
    const second = await runRequest([], homepageRequestReads);
    assert.deepEqual(second.pageSections, { footer: { tagline: "New season" } });
    assert.notEqual(first.layoutCms, second.layoutCms);
  });

  it("a failed read still falls back to empty content", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => json({ message: "down" }, 503)) as typeof fetch;
    try {
      const reads = await runRequest([], homepageRequestReads);
      assert.deepEqual(reads.pageSections, {});
      assert.equal(reads.metadataRow.updatedAt, null);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("categories (C2)", () => {
  async function categoryPageReads() {
    const layout = await catalog.listCategoriesFromDb();
    const metadata = await catalog.listCategoriesFromDb();
    const page = await catalog.listCategoriesFromDb();
    return { layout, metadata, page };
  }

  it("before: without a request scope each call reads the data cache again", async () => {
    await categoryPageReads();
    assert.equal(dataCacheReads.categories, 3);
  });

  it("layout, metadata and page share one data-cache read per request", async () => {
    const reads = await runRequest([], categoryPageReads);
    assert.equal(dataCacheReads.categories, 1);
    assert.equal(calls.categories, 1);
    assert.equal(reads.layout, reads.metadata);
    assert.equal(reads.layout, reads.page);
  });

  it("output is unchanged: database order and fields are preserved", async () => {
    const reads = await runRequest([], categoryPageReads);
    assert.deepEqual(reads.page, db.categories);
  });

  it("an empty category table still falls back to the default categories", async () => {
    db.categories = [];
    const { mockCategories } = await import("../../lib/mock-data");
    const reads = await runRequest([], categoryPageReads);
    assert.deepEqual(reads.page, mockCategories);
  });

  it("memoisation ends with the request", async () => {
    await runRequest([], categoryPageReads);
    db.categories = [{ slug: "suits", name: "Suits", description: null, image_url: null }];
    cacheStore.clear();
    const reads = await runRequest([], categoryPageReads);
    assert.deepEqual(reads.page.map((c) => c.slug), ["suits"]);
  });
});

describe("account session (C3)", () => {
  const ama = { id: "user-ama", email: "Ama@Example.test" };
  const kofi = { id: "user-kofi", email: "kofi@example.test" };

  /** The store layout reads the email, then the product page reads the session. */
  async function productPageRequest() {
    const layoutEmail = await account.getAccountUserEmail();
    const pageSession = await account.getAccountSession();
    const pageSessionAgain = await account.getAccountSession();
    return { layoutEmail, pageSession, pageSessionAgain };
  }

  it("before: without a request scope the layout and page each call Supabase Auth", async () => {
    await requestCookies.run([sessionCookie("token-ama", ama)], productPageRequest);
    assert.equal(calls.auth.length, 3);
  });

  it("layout, metadata and page as separate server components in one render share every lookup", async () => {
    const seen: Record<string, unknown> = {};
    async function Layout({ children }: { children?: unknown }) {
      const [cms, categories, email] = await Promise.all([
        homepageCmsData.getHomepageCms(),
        catalog.listCategoriesFromDb(),
        account.getAccountUserEmail(),
      ]);
      Object.assign(seen, { layoutCms: cms, layoutCategories: categories, email });
      return React.createElement("div", null, children as never);
    }
    async function Metadata() {
      const [row, cms] = await Promise.all([homeContent.getHomeContentRow(), homepageCmsData.getHomepageCms()]);
      Object.assign(seen, { metadataRow: row, metadataCms: cms });
      return null;
    }
    async function Page() {
      const [categories, sections, cms, session] = await Promise.all([
        catalog.listCategoriesFromDb(),
        homeContent.getHomeContentSections(),
        homepageCmsData.getHomepageCms(),
        account.getAccountSession(),
      ]);
      Object.assign(seen, { pageCategories: categories, pageSections: sections, pageCms: cms, session });
      return null;
    }

    await renderRequest(
      [sessionCookie("token-ama", ama)],
      React.createElement(Layout, null, React.createElement(Metadata), React.createElement(Page))
    );

    assert.equal(dataCacheReads.home, 1);
    assert.equal(dataCacheReads.categories, 1);
    assert.deepEqual(calls.auth, ["token-ama"]);
    assert.equal(seen.layoutCms, seen.metadataCms);
    assert.equal(seen.layoutCms, seen.pageCms);
    assert.equal(seen.layoutCategories, seen.pageCategories);
    assert.equal((seen.metadataRow as { sections: unknown }).sections, seen.pageSections);
    assert.equal(seen.email, "ama@example.test");
    assert.equal((seen.session as { user: { id: string } | null }).user?.id, "user-ama");
  });

  it("layout and product page reuse one Auth lookup within a request", async () => {
    const result = await runRequest([sessionCookie("token-ama", ama)], productPageRequest);
    assert.deepEqual(calls.auth, ["token-ama"]);
    assert.equal(result.layoutEmail, "ama@example.test", "email is still trimmed and lower-cased");
    assert.equal(result.pageSession, result.pageSessionAgain);
    assert.equal(result.pageSession.user?.id, "user-ama");
    assert.equal(result.pageSession.user?.user_metadata?.full_name, "Ama");
  });

  it("separate requests by the same user each check Auth again", async () => {
    const first = await runRequest([sessionCookie("token-ama", ama)], productPageRequest);
    const second = await runRequest([sessionCookie("token-ama", ama)], productPageRequest);
    assert.deepEqual(calls.auth, ["token-ama", "token-ama"]);
    assert.notEqual(first.pageSession, second.pageSession);
  });

  it("a revoked session is not served from an earlier request", async () => {
    const first = await runRequest([sessionCookie("token-ama", ama)], productPageRequest);
    assert.equal(first.pageSession.user?.id, "user-ama");
    users.delete("token-ama");
    const second = await runRequest([sessionCookie("token-ama", ama)], productPageRequest);
    assert.equal(second.pageSession.user, null);
    assert.equal(second.layoutEmail, null);
  });

  it("concurrent requests from different users never see each other's session", async () => {
    const results = await Promise.all([
      runRequest([sessionCookie("token-ama", ama)], productPageRequest),
      runRequest([sessionCookie("token-kofi", kofi)], productPageRequest),
      runRequest([], productPageRequest),
      runRequest([sessionCookie("token-kofi", kofi)], productPageRequest),
      runRequest([sessionCookie("token-ama", ama)], productPageRequest),
    ]);
    assert.deepEqual(
      results.map((r) => [r.layoutEmail, r.pageSession.user?.id ?? null]),
      [
        ["ama@example.test", "user-ama"],
        ["kofi@example.test", "user-kofi"],
        [null, null],
        ["kofi@example.test", "user-kofi"],
        ["ama@example.test", "user-ama"],
      ]
    );
    assert.deepEqual(calls.auth.slice().sort(), ["token-ama", "token-ama", "token-kofi", "token-kofi"]);
  });

  it("anonymous visitors make no Auth call and get no session", async () => {
    const result = await runRequest([], productPageRequest);
    assert.equal(result.layoutEmail, null);
    assert.equal(result.pageSession.user, null);
    assert.deepEqual(calls.auth, []);
  });

  it("a signed-in request followed by an anonymous one does not leak the session", async () => {
    await runRequest([sessionCookie("token-ama", ama)], productPageRequest);
    const anonymous = await runRequest([], productPageRequest);
    assert.equal(anonymous.layoutEmail, null);
    assert.equal(anonymous.pageSession.user, null);
  });
});
