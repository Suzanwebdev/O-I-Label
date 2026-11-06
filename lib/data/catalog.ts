import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product, ProductBadge, ProductVariant } from "@/lib/types";
import {
  PUBLIC_CACHE_TAGS,
  PUBLIC_CATALOGUE_REVALIDATE_SECONDS,
  publicCacheKeyParts,
} from "@/lib/cache/public-catalogue";
import { productBelongsToCategorySlug } from "@/lib/catalog/product-categories";
import { applyLiveAvailability, type LiveAvailability } from "@/lib/catalog/variant-stock";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

type DbVariant = {
  id: string;
  sku: string;
  price_ghs: number;
  compare_at_ghs: number | null;
  stock: number;
  size: string | null;
  color: string | null;
};

type DbImage = { storage_path: string; sort_order: number | null };

type DbProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_active: boolean;
  badges: string[] | null;
  occasions: string[] | null;
  love_it_points?: string[] | null;
  rating: number | null;
  review_count: number | null;
  categories: { slug: string; name: string } | null;
  variants: DbVariant[] | null;
  product_images: DbImage[] | null;
};

function mapVariant(v: DbVariant): ProductVariant {
  return {
    id: v.id,
    sku: v.sku,
    price_ghs: Number(v.price_ghs),
    compare_at_ghs:
      v.compare_at_ghs != null ? Number(v.compare_at_ghs) : undefined,
    stock: v.stock,
    size: v.size ?? undefined,
    color: v.color ?? undefined,
  };
}

function uniqueCategorySlugs(row: DbProduct, extraSlugs: string[] = []): string[] {
  const slugs: string[] = [];
  const seen = new Set<string>();
  const primary = row.categories?.slug;
  if (primary) {
    slugs.push(primary);
    seen.add(primary);
  }
  for (const slug of extraSlugs) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs.length ? slugs : primary ? [primary] : ["new-arrivals"];
}

/** Strict mode throws instead of degrading, so partial results are never written to the shared cache. */
async function extraCategorySlugsByProductId(
  supabase: SupabaseClient,
  productIds: string[],
  strict: boolean
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!productIds.length) return map;
  const { data, error } = await supabase
    .from("product_categories")
    .select("product_id, categories!product_categories_category_id_fkey ( slug )")
    .in("product_id", productIds);
  if (error && strict) {
    throw new Error(`[catalog] product_categories query failed: ${error.message}`);
  }
  if (error || !data) return map;
  for (const row of data as {
    product_id: string;
    categories: { slug: string } | { slug: string }[] | null;
  }[]) {
    const cat = row.categories;
    const slug = Array.isArray(cat) ? cat[0]?.slug : cat?.slug;
    if (!slug) continue;
    const current = map.get(row.product_id) ?? [];
    if (!current.includes(slug)) current.push(slug);
    map.set(row.product_id, current);
  }
  return map;
}

function mapRow(row: DbProduct, extraSlugs: string[] = []): Product {
  const imgs = (row.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((i) => i.storage_path);
  const variants = (row.variants ?? []).map(mapVariant);
  const loveLines = Array.isArray(row.love_it_points)
    ? row.love_it_points.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    seo_title: typeof row.seo_title === "string" && row.seo_title.trim() ? row.seo_title.trim() : null,
    seo_description:
      typeof row.seo_description === "string" && row.seo_description.trim() ? row.seo_description.trim() : null,
    category_slug: row.categories?.slug ?? "new-arrivals",
    category_name: row.categories?.name ?? "New Arrivals",
    category_slugs: uniqueCategorySlugs(row, extraSlugs),
    images: imgs.length ? imgs : ["/file.svg"],
    badges: (row.badges ?? []) as ProductBadge[],
    ...(loveLines.length ? { love_it_points: loveLines } : {}),
    occasions: (row.occasions ?? []).filter((o): o is "birthday" | "vacation" | "wedding" | "corporate" =>
      o === "birthday" || o === "vacation" || o === "wedding" || o === "corporate"
    ),
    rating: row.rating ?? undefined,
    review_count: row.review_count ?? undefined,
    variants: variants.length ? variants : [],
    is_active: row.is_active,
  };
}

async function loadActiveProducts(strict: boolean): Promise<Product[]> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, slug, name, description, is_active, badges, occasions, love_it_points, rating, review_count,
      categories!products_category_id_fkey ( slug, name ),
      variants ( id, sku, price_ghs, compare_at_ghs, stock, size, color ),
      product_images ( storage_path, sort_order )
    `
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (strict) throw new Error(`[catalog] products query failed: ${error.message}`);
    return [];
  }
  if (!data?.length) return [];
  const extras = await extraCategorySlugsByProductId(
    supabase,
    (data as { id: string }[]).map((row) => row.id),
    strict
  );
  return (data as unknown as DbProduct[]).map((row) => mapRow(row, extras.get(row.id) ?? []));
}

async function loadActiveProductBySlug(slug: string, strict: boolean): Promise<Product | null> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, slug, name, description, seo_title, seo_description, is_active, badges, occasions, love_it_points, rating, review_count,
      categories!products_category_id_fkey ( slug, name ),
      variants ( id, sku, price_ghs, compare_at_ghs, stock, size, color ),
      product_images ( storage_path, sort_order )
    `
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (strict) throw new Error(`[catalog] product query failed: ${error.message}`);
    return null;
  }
  if (!data) return null;
  const id = (data as { id: string }).id;
  const extras = await extraCategorySlugsByProductId(supabase, [id], strict);
  return mapRow(data as unknown as DbProduct, extras.get(id) ?? []);
}

const PRODUCT_NOT_FOUND = "PUBLIC_PRODUCT_NOT_FOUND";

function isProductNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === PRODUCT_NOT_FOUND;
}

const getCachedActiveProducts = unstable_cache(
  () => loadActiveProducts(true),
  publicCacheKeyParts("active-products"),
  { revalidate: PUBLIC_CATALOGUE_REVALIDATE_SECONDS, tags: [PUBLIC_CACHE_TAGS.products] }
);

/** Misses throw instead of returning null, so arbitrary unknown slugs never create cache entries. */
const getCachedActiveProductBySlug = unstable_cache(
  async (slug: string) => {
    const product = await loadActiveProductBySlug(slug, true);
    if (!product) throw Object.assign(new Error("Product not found"), { code: PRODUCT_NOT_FOUND });
    return product;
  },
  publicCacheKeyParts("product-by-slug"),
  { revalidate: PUBLIC_CATALOGUE_REVALIDATE_SECONDS, tags: [PUBLIC_CACHE_TAGS.products] }
);

/** Products read from the shared cache carry stale stock until `stockIsLive` is true. */
export type CatalogueSnapshot = { products: Product[]; stockIsLive: boolean };

async function loadFreshActiveProducts(): Promise<Product[]> {
  try {
    return await loadActiveProducts(false);
  } catch {
    return [];
  }
}

/** Per-request memo so several callers in one render share a single cache read. */
export const getCatalogueSnapshot = cache(async (): Promise<CatalogueSnapshot> => {
  try {
    return { products: await getCachedActiveProducts(), stockIsLive: false };
  } catch {
    return { products: await loadFreshActiveProducts(), stockIsLive: true };
  }
});

const LIVE_AVAILABILITY_CHUNK_SIZE = 100;

/**
 * Live stock for the given products only. Chunked by id so no response can be
 * truncated by PostgREST's row limit. Returns null when availability cannot be
 * verified, so callers never present cached stock as live.
 */
export async function loadLiveAvailability(productIds: string[]): Promise<LiveAvailability | null> {
  const ids = [...new Set(productIds)];
  const live = new Map<string, Map<string, number>>();
  if (!ids.length) return live;
  try {
    const supabase = createPublicSupabaseClient();
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += LIVE_AVAILABILITY_CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + LIVE_AVAILABILITY_CHUNK_SIZE));
    }
    const responses = await Promise.all(
      chunks.map((chunk) =>
        supabase.from("products").select("id, variants ( id, stock )").eq("is_active", true).in("id", chunk)
      )
    );
    for (const { data, error } of responses) {
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as {
        id: string;
        variants: { id: string; stock: number }[] | null;
      }[]) {
        const variants = new Map<string, number>();
        for (const v of row.variants ?? []) variants.set(String(v.id), Number(v.stock));
        live.set(String(row.id), variants);
      }
    }
    return live;
  } catch (e) {
    console.warn("[catalog] live availability read failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Overlay live availability, or reload fresh from the database when it cannot be verified. */
async function withLiveAvailabilityOrFresh(
  products: Product[],
  loadFresh: () => Promise<Product[]>
): Promise<Product[]> {
  if (!products.length) return products;
  const live = await loadLiveAvailability(products.map((p) => p.id));
  return live ? applyLiveAvailability(products, live) : loadFresh();
}

/** Every active product with live stock (home and shop display the whole catalogue). */
export async function listProducts(): Promise<Product[]> {
  const snapshot = await getCatalogueSnapshot();
  if (snapshot.stockIsLive) return snapshot.products;
  return withLiveAvailabilityOrFresh(snapshot.products, loadFreshActiveProducts);
}

/** Active products in one category, with live stock read for that category only. */
export async function listProductsInCategory(categorySlug: string): Promise<Product[]> {
  const inCategory = (list: Product[]) =>
    list.filter((p) => productBelongsToCategorySlug(p, categorySlug));
  const snapshot = await getCatalogueSnapshot();
  if (snapshot.stockIsLive) return inCategory(snapshot.products);
  return withLiveAvailabilityOrFresh(inCategory(snapshot.products), async () =>
    inCategory(await loadFreshActiveProducts())
  );
}

/** Sitemap needs product URLs only, so stock is never read. */
export async function listProductsForSitemap(): Promise<Product[]> {
  return (await getCatalogueSnapshot()).products;
}

const readProductBySlug = cache(
  async (slug: string): Promise<{ product: Product | null; stockIsLive: boolean }> => {
    try {
      return { product: await getCachedActiveProductBySlug(slug), stockIsLive: false };
    } catch (e) {
      if (isProductNotFound(e)) return { product: null, stockIsLive: true };
      try {
        return { product: await loadActiveProductBySlug(slug, false), stockIsLive: true };
      } catch {
        /* no mock fallback — only real catalog rows */
        return { product: null, stockIsLive: true };
      }
    }
  }
);

/**
 * Product with live stock; null when it is no longer publicly visible. Metadata and
 * the page both call this, so cache() shares one live visibility check per render
 * and a stale cached product can never leak into not-found metadata.
 */
export const getProductBySlugFromDb = cache(async (slug: string): Promise<Product | null> => {
  const normalized = slug.trim();
  if (!normalized) return null;
  const { product, stockIsLive } = await readProductBySlug(normalized);
  if (!product || stockIsLive) return product;
  const live = await loadLiveAvailability([product.id]);
  if (!live) {
    try {
      return await loadActiveProductBySlug(normalized, false);
    } catch {
      return null;
    }
  }
  return applyLiveAvailability([product], live)[0] ?? null;
});

type PublicCategory = {
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
};

const getCachedCategories = unstable_cache(
  async (): Promise<PublicCategory[]> => {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("slug, name, description, image_url")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(`[catalog] categories query failed: ${error.message}`);
    return data ?? [];
  },
  publicCacheKeyParts("categories"),
  { revalidate: PUBLIC_CATALOGUE_REVALIDATE_SECONDS, tags: [PUBLIC_CACHE_TAGS.categories] }
);

export async function listCategoriesFromDb(): Promise<PublicCategory[]> {
  try {
    const data = await getCachedCategories();
    if (data.length) return data;
  } catch {
    /* fall through to defaults */
  }
  const { mockCategories } = await import("@/lib/mock-data");
  return mockCategories;
}
