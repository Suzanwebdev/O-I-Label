import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { afterEach, before, beforeEach, describe, it, mock } from "node:test";

/**
 * Sitemap route (`app/sitemap.xml/route.ts`). The real handler runs against a fake
 * Supabase (global fetch) and an in-memory data cache — no network, no database.
 * A signed-in visitor's cookies are present so the tests can prove the sitemap's
 * blog read never uses the visitor's session.
 */

const SUPABASE_URL = "https://unit-test.supabase.co";
const ANON_KEY = "unit-test-anon-key";
const SERVICE_KEY = "unit-test-service-role-key";
const USER_TOKEN = "visitor-access-token";

type Kind = "catalogue" | "stock" | "product_categories" | "categories" | "blog" | "auth" | "other";
type Call = { kind: Kind; url: URL; apikey: string | null; bearer: string | null };

type FakeProduct = { id: string; slug: string; is_active: boolean; variants: number };
const db = {
  products: [] as FakeProduct[],
  categories: [] as { slug: string; name: string; sort_order: number }[],
  posts: [] as { slug: string; published: boolean; published_at: string | null; title: string }[],
  fail: { catalogue: false, categories: false, blog: false },
};
const calls: Call[] = [];
const cacheStore = new Map<string, unknown>();
const cacheControl = { unavailable: false };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : undefined;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const headers = new Headers(init?.headers ?? request?.headers);
  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select") ?? "";
  const authorization = headers.get("authorization") ?? "";
  const kind: Kind =
    url.pathname === "/auth/v1/user"
      ? "auth"
      : table === "products"
        ? select.startsWith("id,variants(id,stock)")
          ? "stock"
          : "catalogue"
        : table === "product_categories"
          ? "product_categories"
          : table === "categories"
            ? "categories"
            : table === "blog_posts"
              ? "blog"
              : "other";
  calls.push({
    kind,
    url,
    apikey: headers.get("apikey"),
    bearer: authorization.startsWith("Bearer ") ? authorization.slice(7) : null,
  });

  switch (kind) {
    case "auth":
      return json({ id: "visitor", email: "visitor@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} });
    case "catalogue":
      if (db.fail.catalogue) return json({ message: "catalogue unavailable" }, 503);
      return json(
        db.products
          .filter((p) => p.is_active)
          .map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.slug,
            description: "",
            is_active: true,
            badges: [],
            occasions: [],
            love_it_points: [],
            rating: null,
            review_count: null,
            categories: { slug: "dresses", name: "Dresses" },
            variants: Array.from({ length: p.variants }, (_, i) => ({
              id: `${p.id}-v${i}`,
              sku: `${p.id}-sku${i}`,
              price_ghs: 100,
              compare_at_ghs: null,
              stock: 1,
              size: "M",
              color: "Black",
            })),
            product_images: [],
          }))
      );
    case "product_categories":
      return json([]);
    case "categories":
      if (db.fail.categories) return json({ message: "categories unavailable" }, 503);
      return json([...db.categories].sort((a, b) => a.sort_order - b.sort_order).map(({ slug, name }) => ({ slug, name, description: null, image_url: null })));
    case "blog": {
      if (db.fail.blog) return json({ message: "blog unavailable" }, 503);
      const publishedOnly = url.searchParams.get("published") === "eq.true";
      const columns = select.split(",");
      const rows = db.posts
        .filter((p) => !publishedOnly || p.published)
        .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
      return json(rows.map((row) => Object.fromEntries(columns.map((c) => [c, (row as Record<string, unknown>)[c] ?? null]))));
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
    if (cacheControl.unavailable) throw new Error("data cache unavailable");
    return cacheStore.has(key) ? { isStale: false, value: cacheStore.get(key) } : null;
  },
  async set(key: string, value: unknown) {
    if (cacheControl.unavailable) throw new Error("data cache unavailable");
    cacheStore.set(key, value);
  },
};

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
const headersPath = requireFromRoot.resolve("next/headers");
const headersModule = new Module(headersPath);
headersModule.filename = headersPath;
const visitorSession = {
  access_token: USER_TOKEN,
  refresh_token: "visitor-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "visitor", email: "visitor@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
};
const visitorCookie = { name: "sb-unit-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(visitorSession)).toString("base64url")}` };
headersModule.exports = {
  async cookies() {
    return { getAll: () => [{ ...visitorCookie }], get: () => visitorCookie, set: () => {} };
  },
};
headersModule.loaded = true;
requireFromRoot.cache[headersPath] = headersModule;

let route: typeof import("../app/sitemap.xml/route");
let robots: typeof import("../app/robots");
let blog: typeof import("../lib/data/blog");
let catalog: typeof import("../lib/data/catalog");
let sitemapXml: typeof import("../lib/seo/sitemap-xml");
const errors: string[] = [];

before(async () => {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  process.env.APP_BASE_URL = "https://www.example-shop.test/";
  globalThis.fetch = fakeFetch as typeof fetch;
  (globalThis as unknown as { __incrementalCache: unknown }).__incrementalCache = fakeIncrementalCache;
  route = await import("../app/sitemap.xml/route");
  robots = await import("../app/robots");
  blog = await import("../lib/data/blog");
  catalog = await import("../lib/data/catalog");
  sitemapXml = await import("../lib/seo/sitemap-xml");
});

beforeEach(() => {
  db.products = [
    { id: "p1", slug: "silk-dress", is_active: true, variants: 2 },
    { id: "p2", slug: "linen-top", is_active: true, variants: 1 },
    { id: "p3", slug: "retired-gown", is_active: false, variants: 1 },
    { id: "p4", slug: "sample-only", is_active: true, variants: 0 },
  ];
  db.categories = [
    { slug: "tops", name: "Tops", sort_order: 2 },
    { slug: "dresses", name: "Dresses", sort_order: 1 },
  ];
  db.posts = [
    { slug: "spring-edit", published: true, published_at: "2026-10-01T09:00:00.000Z", title: "Spring edit" },
    { slug: "draft-post", published: false, published_at: null, title: "Draft" },
    { slug: "styling-silk", published: true, published_at: "2026-10-20T12:30:00.000Z", title: "Styling silk" },
    { slug: "undated-note", published: true, published_at: null, title: "Undated" },
  ];
  db.fail = { catalogue: false, categories: false, blog: false };
  cacheControl.unavailable = false;
  calls.length = 0;
  cacheStore.clear();
  errors.length = 0;
  mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  mock.restoreAll();
});

type Url = { loc: string; lastmod?: string; changefreq?: string; priority?: string };

function parse(xml: string): Url[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const field = (name: string) => m[1]!.match(new RegExp(`<${name}>(.*?)</${name}>`))?.[1];
    return { loc: field("loc")!, lastmod: field("lastmod"), changefreq: field("changefreq"), priority: field("priority") };
  });
}

async function fetchSitemap() {
  const res = await route.GET();
  return { res, body: await res.text() };
}

const BASE = "https://www.example-shop.test";
const STATIC_PATHS = [
  "",
  "/shop",
  "/blog",
  "/about",
  "/contact",
  "/track-order",
  "/policies/shipping",
  "/policies/returns",
  "/policies/privacy",
  "/policies/cookies",
  "/policies/terms",
];

describe("sitemap entries", () => {
  it("lists exactly the static pages, categories, active products with variants and published posts", async () => {
    const { res, body } = await fetchSitemap();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/xml");
    assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
    assert.deepEqual(
      parse(body).map((u) => u.loc),
      [
        ...STATIC_PATHS.map((p) => (p === "" ? BASE : `${BASE}${p}`)),
        `${BASE}/shop/dresses`,
        `${BASE}/shop/tops`,
        `${BASE}/product/silk-dress`,
        `${BASE}/product/linen-top`,
        `${BASE}/blog/styling-silk`,
        `${BASE}/blog/spring-edit`,
        `${BASE}/blog/undated-note`,
      ]
    );
  });

  it("has no duplicate URLs and keeps the existing priorities and change frequencies", async () => {
    const urls = parse((await fetchSitemap()).body);
    assert.equal(new Set(urls.map((u) => u.loc)).size, urls.length);
    const byPath = new Map(urls.map((u) => [u.loc.replace(BASE, "") || "/", u]));
    assert.deepEqual([byPath.get("/")!.priority, byPath.get("/")!.changefreq], ["1", "daily"]);
    assert.deepEqual([byPath.get("/shop/dresses")!.priority, byPath.get("/shop/dresses")!.changefreq], ["0.8", "weekly"]);
    assert.deepEqual([byPath.get("/product/silk-dress")!.priority, byPath.get("/product/silk-dress")!.changefreq], ["0.85", "weekly"]);
    assert.deepEqual([byPath.get("/blog/spring-edit")!.priority, byPath.get("/blog/spring-edit")!.changefreq], ["0.65", "monthly"]);
    assert.deepEqual([byPath.get("/policies/terms")!.priority, byPath.get("/policies/terms")!.changefreq], ["0.4", "yearly"]);
  });

  it("builds URLs from getSiteUrl() and never reads stock", async () => {
    const { getSiteUrl } = await import("../lib/seo/site");
    assert.equal(getSiteUrl(), BASE, "trailing slash removed as before");
    const urls = parse((await fetchSitemap()).body);
    assert.ok(urls.every((u) => u.loc === BASE || u.loc.startsWith(`${BASE}/`)));
    assert.equal(calls.filter((c) => c.kind === "stock").length, 0);
    assert.equal(calls.filter((c) => c.kind === "auth").length, 0, "no session lookup");
  });

  it("excludes unpublished and no-variant products and unpublished posts", async () => {
    const locs = parse((await fetchSitemap()).body).map((u) => u.loc);
    for (const excluded of ["/product/retired-gown", "/product/sample-only", "/blog/draft-post"]) {
      assert.equal(locs.includes(`${BASE}${excluded}`), false, excluded);
    }
  });

  it("produces exactly the expected XML (fixed fixture, byte for byte)", async () => {
    const { body } = await fetchSitemap();
    assert.equal(body, EXPECTED_SITEMAP_XML);
  });
});

/** The route's complete output for the standard fixture; matches Next's previous serializer byte for byte. */
const EXPECTED_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://www.example-shop.test</loc>
<changefreq>daily</changefreq>
<priority>1</priority>
</url>
<url>
<loc>https://www.example-shop.test/shop</loc>
<changefreq>daily</changefreq>
<priority>0.9</priority>
</url>
<url>
<loc>https://www.example-shop.test/blog</loc>
<changefreq>weekly</changefreq>
<priority>0.7</priority>
</url>
<url>
<loc>https://www.example-shop.test/about</loc>
<changefreq>monthly</changefreq>
<priority>0.6</priority>
</url>
<url>
<loc>https://www.example-shop.test/contact</loc>
<changefreq>monthly</changefreq>
<priority>0.6</priority>
</url>
<url>
<loc>https://www.example-shop.test/track-order</loc>
<changefreq>monthly</changefreq>
<priority>0.5</priority>
</url>
<url>
<loc>https://www.example-shop.test/policies/shipping</loc>
<changefreq>yearly</changefreq>
<priority>0.4</priority>
</url>
<url>
<loc>https://www.example-shop.test/policies/returns</loc>
<changefreq>yearly</changefreq>
<priority>0.4</priority>
</url>
<url>
<loc>https://www.example-shop.test/policies/privacy</loc>
<changefreq>yearly</changefreq>
<priority>0.4</priority>
</url>
<url>
<loc>https://www.example-shop.test/policies/cookies</loc>
<changefreq>yearly</changefreq>
<priority>0.4</priority>
</url>
<url>
<loc>https://www.example-shop.test/policies/terms</loc>
<changefreq>yearly</changefreq>
<priority>0.4</priority>
</url>
<url>
<loc>https://www.example-shop.test/shop/dresses</loc>
<changefreq>weekly</changefreq>
<priority>0.8</priority>
</url>
<url>
<loc>https://www.example-shop.test/shop/tops</loc>
<changefreq>weekly</changefreq>
<priority>0.8</priority>
</url>
<url>
<loc>https://www.example-shop.test/product/silk-dress</loc>
<changefreq>weekly</changefreq>
<priority>0.85</priority>
</url>
<url>
<loc>https://www.example-shop.test/product/linen-top</loc>
<changefreq>weekly</changefreq>
<priority>0.85</priority>
</url>
<url>
<loc>https://www.example-shop.test/blog/styling-silk</loc>
<lastmod>2026-10-20T12:30:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.65</priority>
</url>
<url>
<loc>https://www.example-shop.test/blog/spring-edit</loc>
<lastmod>2026-10-01T09:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.65</priority>
</url>
<url>
<loc>https://www.example-shop.test/blog/undated-note</loc>
<changefreq>monthly</changefreq>
<priority>0.65</priority>
</url>
</urlset>
`;

/**
 * Well-formedness for the sitemap subset this site emits: the exact element
 * structure, and text that contains no raw `<` or unescaped `&`.
 */
const TEXT = String.raw`(?:[^<&]|&(?:amp|lt|gt|quot|apos);)*`;
const WELL_FORMED_SITEMAP = new RegExp(
  String.raw`^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http://www\.sitemaps\.org/schemas/sitemap/0\.9">\n` +
    String.raw`(?:<url>\n<loc>${TEXT}</loc>\n(?:<lastmod>${TEXT}</lastmod>\n)?(?:<changefreq>${TEXT}</changefreq>\n)?(?:<priority>[0-9.]+</priority>\n)?</url>\n)*` +
    String.raw`</urlset>\n$`
);

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

describe("sitemap XML serializer", () => {
  it("escapes the five XML special characters", () => {
    assert.equal(sitemapXml.escapeXml(`a&b<c>d"e'f`), "a&amp;b&lt;c&gt;d&quot;e&apos;f");
    assert.equal(sitemapXml.escapeXml("&amp;"), "&amp;amp;", "already-escaped text is escaped again, not passed through");
    assert.equal(sitemapXml.escapeXml("plain-slug-123"), "plain-slug-123");
  });

  it("produces the expected XML for current site shapes", () => {
    const xml = sitemapXml.serializeSitemap([
      { url: "https://www.oandilabel.com", changeFrequency: "daily", priority: 1 },
      { url: "https://www.oandilabel.com/product/3d-floral-silk-dress", changeFrequency: "weekly", priority: 0.85 },
      {
        url: "https://www.oandilabel.com/blog/spring-edit",
        lastModified: new Date("2026-10-01T09:00:00.000Z"),
        changeFrequency: "monthly",
        priority: 0.65,
      },
    ]);
    assert.equal(
      xml,
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://www.oandilabel.com</loc>
<changefreq>daily</changefreq>
<priority>1</priority>
</url>
<url>
<loc>https://www.oandilabel.com/product/3d-floral-silk-dress</loc>
<changefreq>weekly</changefreq>
<priority>0.85</priority>
</url>
<url>
<loc>https://www.oandilabel.com/blog/spring-edit</loc>
<lastmod>2026-10-01T09:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.65</priority>
</url>
</urlset>
`
    );
    assert.match(xml, WELL_FORMED_SITEMAP);
  });

  it("an empty entry list is a valid, empty urlset", () => {
    const xml = sitemapXml.serializeSitemap([]);
    assert.equal(
      xml,
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`
    );
    assert.match(xml, WELL_FORMED_SITEMAP);
  });

  it("omits optional fields that are not set and keeps lastModified strings as given", () => {
    const xml = sitemapXml.serializeSitemap([
      { url: "https://www.oandilabel.com/a" },
      { url: "https://www.oandilabel.com/b", lastModified: "2026-10-20" },
      { url: "https://www.oandilabel.com/c", priority: 0 },
    ]);
    assert.equal(
      xml,
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://www.oandilabel.com/a</loc>
</url>
<url>
<loc>https://www.oandilabel.com/b</loc>
<lastmod>2026-10-20</lastmod>
</url>
<url>
<loc>https://www.oandilabel.com/c</loc>
<priority>0</priority>
</url>
</urlset>
`
    );
    assert.match(xml, WELL_FORMED_SITEMAP);
  });

  it("URLs and dates with special characters stay well-formed and decode to the original values", () => {
    const urls = [
      "https://www.oandilabel.com/product/salt&pepper-set",
      "https://www.oandilabel.com/shop/<new>",
      `https://www.oandilabel.com/blog/it's-"here"`,
    ];
    const xml = sitemapXml.serializeSitemap([
      ...urls.map((url) => ({ url, changeFrequency: "weekly" as const, priority: 0.8 })),
      { url: "https://www.oandilabel.com/x", lastModified: "2026-10-20&<>" },
    ]);
    assert.match(xml, WELL_FORMED_SITEMAP);
    assert.match(xml, /<loc>https:\/\/www\.oandilabel\.com\/product\/salt&amp;pepper-set<\/loc>/);
    assert.match(xml, /<lastmod>2026-10-20&amp;&lt;&gt;<\/lastmod>/);
    const decoded = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => unescapeXml(m[1]!));
    assert.deepEqual(decoded.slice(0, 3), urls);
  });

  it("the sitemap route's output is well-formed", async () => {
    assert.match((await fetchSitemap()).body, WELL_FORMED_SITEMAP);
  });

  it("neither the route nor the serializer imports Next.js internals", () => {
    for (const file of ["app/sitemap.xml/route.ts", "lib/seo/sitemap-xml.ts"]) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /next\/dist\//, file);
      assert.doesNotMatch(source, /resolve-route-data|resolveRouteData/, file);
    }
    assert.match(readFileSync("app/sitemap.xml/route.ts", "utf8"), /from "@\/lib\/seo\/sitemap-xml"/);
  });
});

describe("lastModified", () => {
  it("static pages, categories and products carry no fabricated date; posts keep published_at", async () => {
    const urls = parse((await fetchSitemap()).body);
    for (const u of urls.filter((u) => !u.loc.includes("/blog/"))) {
      assert.equal(u.lastmod, undefined, u.loc);
    }
    const post = (slug: string) => urls.find((u) => u.loc === `${BASE}/blog/${slug}`)!;
    assert.equal(post("spring-edit").lastmod, "2026-10-01T09:00:00.000Z");
    assert.equal(post("styling-silk").lastmod, "2026-10-20T12:30:00.000Z");
    assert.equal(post("undated-note").lastmod, undefined, "no date invented for an undated post");
  });

  it("the route no longer stamps the generation time", () => {
    const source = readFileSync("app/sitemap.xml/route.ts", "utf8");
    assert.doesNotMatch(source, /new Date\(\)/);
    assert.doesNotMatch(source, /revalidate\s*=/);
    assert.match(source, /export const dynamic = "force-dynamic";/);
    assert.equal(existsSync("app/sitemap.ts"), false, "no competing metadata sitemap route");
  });
});

describe("sitemap blog query", () => {
  it("uses the cookie-free public client and selects only slug and published_at, published and newest first", async () => {
    await fetchSitemap();
    const blogCalls = calls.filter((c) => c.kind === "blog");
    assert.equal(blogCalls.length, 1);
    const call = blogCalls[0]!;
    assert.equal(call.apikey, ANON_KEY);
    assert.equal(call.bearer, ANON_KEY, "never the visitor's session token");
    assert.equal(call.url.searchParams.get("select"), "slug,published_at");
    assert.equal(call.url.searchParams.get("published"), "eq.true");
    assert.equal(call.url.searchParams.get("order"), "published_at.desc.nullslast");
  });

  it("the blog pages' loader is unchanged", async () => {
    const posts = await blog.listPublishedBlogPosts();
    assert.deepEqual(posts.map((p) => p.slug), ["styling-silk", "spring-edit", "undated-note"]);
    const call = calls.filter((c) => c.kind === "blog").at(-1)!;
    assert.equal(call.bearer, USER_TOKEN, "still the cookie-bound client");
    assert.equal(call.url.searchParams.get("select"), "id,slug,title,excerpt,cover_path,published_at");
    const source = readFileSync("lib/data/blog.ts", "utf8");
    const listFn = source.slice(source.indexOf("export async function listPublishedBlogPosts("), source.indexOf("export type SitemapBlogPost"));
    assert.match(listFn, /createServerSupabaseClient\(\)/);
    assert.match(listFn, /if \(error \|\| !data\) return \[\];/);
  });
});

describe("failure handling", () => {
  function assertUnavailable(res: Response, body: string) {
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("retry-after"), "300");
    assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.doesNotMatch(body, /<urlset|<loc>/);
  }

  it("a product query failure returns 503", async () => {
    db.fail.catalogue = true;
    const { res, body } = await fetchSitemap();
    assertUnavailable(res, body);
    assert.ok(errors.some((e) => e.includes("[sitemap] products could not be read")));
  });

  it("a category query failure returns 503 and never falls back to default categories", async () => {
    db.fail.categories = true;
    const { res, body } = await fetchSitemap();
    assertUnavailable(res, body);
    assert.ok(errors.some((e) => e.includes("[sitemap] categories could not be read")));
  });

  it("a blog query failure returns 503", async () => {
    db.fail.blog = true;
    const { res, body } = await fetchSitemap();
    assertUnavailable(res, body);
    assert.ok(errors.some((e) => e.includes("[sitemap] blog posts could not be read")));
  });

  it("failure logs carry no keys or tokens", async () => {
    db.fail = { catalogue: true, categories: true, blog: true };
    await fetchSitemap();
    assert.ok(errors.length >= 3);
    for (const e of errors) assert.doesNotMatch(e, new RegExp(`${ANON_KEY}|${SERVICE_KEY}|${USER_TOKEN}`));
  });

  it("genuinely empty sources are a valid sitemap of static pages only, with no default categories", async () => {
    db.products = [];
    db.categories = [];
    db.posts = [];
    const { res, body } = await fetchSitemap();
    assert.equal(res.status, 200);
    assert.deepEqual(parse(body).map((u) => u.loc), STATIC_PATHS.map((p) => (p === "" ? BASE : `${BASE}${p}`)));
  });

  it("failures are not cached: the next request after recovery is complete", async () => {
    db.fail.catalogue = true;
    db.fail.categories = true;
    assert.equal((await fetchSitemap()).res.status, 503);
    const sourceKeys = () => [...cacheStore.keys()].filter((k) => k.includes(",active-products") || k.includes(",categories"));
    assert.equal(sourceKeys().length, 0, "nothing cached for the failed reads");
    db.fail.catalogue = false;
    db.fail.categories = false;
    const { res, body } = await fetchSitemap();
    assert.equal(res.status, 200);
    assert.equal(sourceKeys().length, 2, "successful reads are cached under the existing catalogue keys");
    assert.ok(parse(body).some((u) => u.loc === `${BASE}/product/silk-dress`));
    assert.ok(parse(body).some((u) => u.loc === `${BASE}/shop/dresses`));
  });

  it("an unavailable data cache falls back to direct strict reads", async () => {
    cacheControl.unavailable = true;
    const { res, body } = await fetchSitemap();
    assert.equal(res.status, 200);
    assert.equal(parse(body).length, STATIC_PATHS.length + 2 + 2 + 3);
  });

  it("warm catalogue caches still serve products and categories when the database later fails", async () => {
    await fetchSitemap();
    db.fail.catalogue = true;
    db.fail.categories = true;
    const { res, body } = await fetchSitemap();
    assert.equal(res.status, 200);
    assert.equal(parse(body).length, STATIC_PATHS.length + 2 + 2 + 3);
  });
});

describe("storefront behaviour is unchanged", () => {
  it("storefront categories still fall back to the defaults when the query fails", async () => {
    db.fail.categories = true;
    const { mockCategories } = await import("../lib/mock-data");
    assert.deepEqual(await catalog.listCategoriesFromDb(), mockCategories);
  });

  it("storefront catalogue still degrades to an empty list instead of throwing", async () => {
    db.fail.catalogue = true;
    const snapshot = await catalog.getCatalogueSnapshot();
    assert.deepEqual(snapshot, { products: [], stockIsLive: true });
  });

  it("robots.txt is unchanged", () => {
    assert.deepEqual(robots.default(), {
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: ["/admin/", "/superadmin/", "/api/", "/account/", "/cart", "/checkout", "/login", "/signup", "/maintenance"],
        },
      ],
      sitemap: `${BASE}/sitemap.xml`,
      host: BASE,
    });
  });
});
