import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { PassThrough } from "node:stream";
import { before, beforeEach, describe, it } from "node:test";

/**
 * Runs under `node --conditions=react-server` (launched by
 * tests/product-page-live-stock.test.ts). Each request is a real React Flight
 * render using the renderer and React bundled with Next, so `cache()` behaves as
 * in production: the product page's metadata and page components share one
 * `getProductPageData` result (one live-stock read) per request, never across
 * requests. Supabase is a fake global fetch; no network, no database.
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

const React = requireFromRoot("react") as typeof import("react");
type Flight = {
  renderToPipeableStream(
    model: unknown,
    webpackMap: unknown,
    options?: { onError?: (error: unknown) => void }
  ): { pipe<T extends NodeJS.WritableStream>(destination: T): T };
};
const flight = requireFromRoot("next/dist/compiled/react-server-dom-webpack/server.node") as Flight;

function renderRequest(element: unknown): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const sink = new PassThrough();
    sink.on("data", () => {});
    sink.on("end", resolve);
    sink.on("error", reject);
    flight.renderToPipeableStream(element, {}, { onError: reject }).pipe(sink);
  });
}

const stockReads: string[][] = [];
const cacheStore = new Map<string, unknown>();
const products = [
  { id: "a", slug: "alpha", name: "Alpha", stock: 2 },
  { id: "b", slug: "bravo", name: "Bravo", stock: 3 },
  { id: "c", slug: "charlie", name: "Charlie", stock: 0 },
  { id: "d", slug: "delta", name: "Delta", stock: 4 },
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

async function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select") ?? "";
  if (table !== "products") return json([]);
  if (select.startsWith("id,variants(id,stock)")) {
    const ids = (url.searchParams.get("id") ?? "").replace(/^in\.\(|\)$/g, "").split(",").map((s) => s.replace(/"/g, ""));
    stockReads.push(ids);
    return json(products.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, variants: [{ id: `${p.id}-v`, stock: p.stock }] })));
  }
  const slug = url.searchParams.get("slug")?.replace(/^eq\./, "");
  return json(
    products
      .filter((p) => !slug || p.slug === slug)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: "",
        is_active: true,
        badges: [],
        occasions: [],
        love_it_points: [],
        rating: null,
        review_count: null,
        categories: { slug: "dresses", name: "Dresses" },
        variants: [{ id: `${p.id}-v`, sku: `${p.id}-sku`, price_ghs: 100, compare_at_ghs: null, stock: p.stock, size: "M", color: "Black" }],
        product_images: [],
      }))
  );
}

let related: typeof import("../../lib/data/related-products");

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-anon-key";
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = {
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
  related = await import("../../lib/data/related-products");
});

beforeEach(() => {
  stockReads.length = 0;
});

type PageData = Awaited<ReturnType<typeof related.getProductPageData>>;

/** Mirrors the product route: metadata and page components resolve the same slug in one render. */
function productRoute(slug: string, seen: PageData[]) {
  async function Metadata() {
    seen.push(await related.getProductPageData(slug));
    return null;
  }
  async function Page() {
    seen.push(await related.getProductPageData(slug));
    return null;
  }
  return React.createElement("main", null, React.createElement(Metadata), React.createElement(Page));
}

describe("getProductPageData request scope", () => {
  it("runs against React's server build and Next's Flight renderer", () => {
    assert.equal((React as unknown as { useState?: unknown }).useState, undefined);
  });

  it("metadata and page in one request share one result and one live-stock read", async () => {
    const seen: PageData[] = [];
    await renderRequest(productRoute("alpha", seen));
    assert.equal(seen.length, 2);
    assert.equal(seen[0], seen[1], "same object");
    assert.equal(stockReads.length, 1);
    assert.deepEqual(stockReads[0]!.slice().sort(), ["a", "b", "c", "d"]);
    assert.deepEqual(seen[0]!.related.map((p) => p.id), ["b", "d"], "sold-out candidate excluded");
  });

  it("separate requests each read live stock again", async () => {
    await renderRequest(productRoute("alpha", []));
    products[1]!.stock = 0;
    const seen: PageData[] = [];
    await renderRequest(productRoute("alpha", seen));
    assert.equal(stockReads.length, 2);
    assert.deepEqual(seen[0]!.related.map((p) => p.id), ["d"], "the second request sees the new stock");
    products[1]!.stock = 3;
  });

  it("concurrent requests for different products stay independent", async () => {
    const alpha: PageData[] = [];
    const delta: PageData[] = [];
    await Promise.all([renderRequest(productRoute("alpha", alpha)), renderRequest(productRoute("delta", delta))]);
    assert.equal(stockReads.length, 2);
    assert.equal(alpha[0]!.product!.id, "a");
    assert.equal(delta[0]!.product!.id, "d");
    assert.equal(alpha[0], alpha[1]);
    assert.equal(delta[0], delta[1]);
  });
});
