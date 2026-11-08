import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/lib/types";
import {
  applyLiveProductAvailability,
  getCatalogueSnapshot,
  listProducts,
  loadLiveAvailability,
  readProductBySlug,
  type CatalogueSnapshot,
} from "@/lib/data/catalog";
import {
  PUBLIC_CACHE_TAGS,
  PUBLIC_CATALOGUE_REVALIDATE_SECONDS,
  publicCacheKeyParts,
  publicCacheWindow,
} from "@/lib/cache/public-catalogue";
import { applyLiveAvailability, type LiveAvailability } from "@/lib/catalog/variant-stock";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isPurchasable(product: Product): boolean {
  return product.is_active && product.variants.length > 0 && product.variants.some((v) => v.stock > 0);
}

/** Strict mode throws on query errors instead of degrading, so a failed read is never cached. */
async function queryCollectionPeerIds(
  supabase: SupabaseClient,
  productId: string,
  strict: boolean
): Promise<string[]> {
  const { data: memberships, error: memErr } = await supabase
    .from("collection_products")
    .select("collection_id")
    .eq("product_id", productId);

  if (memErr && strict) throw new Error(`[related] collection memberships query failed: ${memErr.message}`);
  if (memErr || !memberships?.length) return [];

  const collectionIds = memberships.map((m) => m.collection_id);
  const { data: peers, error: peerErr } = await supabase
    .from("collection_products")
    .select("product_id")
    .in("collection_id", collectionIds)
    .neq("product_id", productId);

  if (peerErr && strict) throw new Error(`[related] collection peers query failed: ${peerErr.message}`);
  if (peerErr || !peers?.length) return [];
  return peers.map((p) => p.product_id);
}

/**
 * `collection_products` is readable by every role (policy `using (true)`), so the
 * cookie-free client returns exactly what anonymous visitors already see.
 */
const getCachedCollectionPeerIds = unstable_cache(
  async (productId: string, window: number): Promise<string[]> => {
    void window;
    return queryCollectionPeerIds(createPublicSupabaseClient(), productId, true);
  },
  publicCacheKeyParts("collection-peers"),
  {
    revalidate: PUBLIC_CATALOGUE_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.collections, PUBLIC_CACHE_TAGS.products],
  }
);

async function getCollectionPeerIds(productId: string): Promise<Set<string>> {
  try {
    return new Set(
      await getCachedCollectionPeerIds(productId, publicCacheWindow(PUBLIC_CATALOGUE_REVALIDATE_SECONDS))
    );
  } catch {
    try {
      const supabase = await createServerSupabaseClient();
      return new Set(await queryCollectionPeerIds(supabase, productId, false));
    } catch {
      return new Set();
    }
  }
}

function scoreRelatedProduct(current: Product, candidate: Product, collectionPeers: Set<string>): number {
  let score = 0;
  if (collectionPeers.has(candidate.id)) score += 100;
  if (candidate.category_slug === current.category_slug) score += 50;
  const currentOccasions = new Set(current.occasions ?? []);
  for (const tag of candidate.occasions ?? []) {
    if (currentOccasions.has(tag)) score += 15;
  }
  if (candidate.badges.includes("best_seller")) score += 8;
  if (candidate.badges.includes("new")) score += 4;
  score += candidate.rating ?? 0;
  return score;
}

/** Candidates in rank order: score descending, then name. Stock does not affect ranking. */
export function rankRelatedCandidates(
  current: Product,
  catalog: Product[],
  collectionPeers: Set<string>
): Product[] {
  return catalog
    .filter((p) => p.id !== current.id)
    .map((product) => ({ product, score: scoreRelatedProduct(current, product, collectionPeers) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.product.name.localeCompare(b.product.name);
    })
    .map((r) => r.product);
}

function relatedBatchSize(limit: number): number {
  return Math.max(limit * 2, 1);
}

/**
 * First `limit` purchasable products in rank order. Live stock is read only for
 * successive batches of top-ranked candidates until enough are purchasable.
 * Returns null if live availability cannot be verified.
 */
export async function pickPurchasableInRankOrder(
  ranked: Product[],
  limit: number,
  loadLive: (productIds: string[]) => Promise<LiveAvailability | null>,
  batchSize = relatedBatchSize(limit)
): Promise<Product[] | null> {
  const picked: Product[] = [];
  for (let start = 0; start < ranked.length && picked.length < limit; start += batchSize) {
    const batch = ranked.slice(start, start + batchSize);
    const live = await loadLive(batch.map((p) => p.id));
    if (!live) return null;
    for (const product of applyLiveAvailability(batch, live)) {
      if (isPurchasable(product)) picked.push(product);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

type RelatedCandidates = {
  snapshot: CatalogueSnapshot;
  collectionPeers: Set<string>;
  ranked: Product[];
};

async function prepareRelatedCandidates(current: Product): Promise<RelatedCandidates> {
  const [snapshot, collectionPeers] = await Promise.all([
    getCatalogueSnapshot(),
    getCollectionPeerIds(current.id),
  ]);
  return { snapshot, collectionPeers, ranked: rankRelatedCandidates(current, snapshot.products, collectionPeers) };
}

/**
 * `firstBatchLive`, when given, is a successful live read that covers the first
 * `relatedBatchSize(limit)` ranked candidates; later batches are read as usual.
 */
async function pickRelatedProducts(
  current: Product,
  limit: number,
  { snapshot, collectionPeers, ranked }: RelatedCandidates,
  firstBatchLive: LiveAvailability | null = null
): Promise<Product[]> {
  if (snapshot.stockIsLive) {
    return ranked.filter(isPurchasable).slice(0, limit);
  }

  let preloaded = firstBatchLive;
  const picked = await pickPurchasableInRankOrder(ranked, limit, async (productIds) => {
    if (preloaded) {
      const live = preloaded;
      preloaded = null;
      return live;
    }
    return loadLiveAvailability(productIds);
  });
  if (picked) return picked;

  const fresh = await listProducts();
  return rankRelatedCandidates(current, fresh, collectionPeers).filter(isPurchasable).slice(0, limit);
}

/**
 * Automatic related products: collection peers → same category → shared occasions → catalog fallback.
 */
export async function getRelatedProducts(current: Product, limit = 10): Promise<Product[]> {
  return pickRelatedProducts(current, limit, await prepareRelatedCandidates(current));
}

const PRODUCT_PAGE_RELATED_LIMIT = 10;

export type ProductPageData = { product: Product | null; related: Product[] };

const PRODUCT_NOT_FOUND: ProductPageData = { product: null, related: [] };

/**
 * Product page data with one live-stock read for the product and the first batch
 * of related candidates (ranking never depends on stock, so it is computed from
 * cached rows first). The live read stays authoritative for visibility: a product
 * missing from it is not found. Request-scoped only — metadata and the page share
 * one result per request; stock never enters a data cache.
 */
export const getProductPageData = cache(async (slug: string): Promise<ProductPageData> => {
  const normalized = slug.trim();
  if (!normalized) return PRODUCT_NOT_FOUND;
  const { product: cached, stockIsLive } = await readProductBySlug(normalized);
  // Live overlays only remove variants, so a cached product without variants is not found either way.
  if (!cached || cached.variants.length === 0) return PRODUCT_NOT_FOUND;
  if (stockIsLive) {
    return { product: cached, related: await getRelatedProducts(cached, PRODUCT_PAGE_RELATED_LIMIT) };
  }

  const candidates = await prepareRelatedCandidates(cached);
  const firstBatch = candidates.snapshot.stockIsLive
    ? []
    : candidates.ranked.slice(0, relatedBatchSize(PRODUCT_PAGE_RELATED_LIMIT));
  const live = await loadLiveAvailability([cached.id, ...firstBatch.map((p) => p.id)]);

  const product = await applyLiveProductAvailability(normalized, cached, live);
  if (!product) return PRODUCT_NOT_FOUND;
  if (product.variants.length === 0) return { product, related: [] };
  if (!live) {
    return { product, related: await getRelatedProducts(product, PRODUCT_PAGE_RELATED_LIMIT) };
  }
  return {
    product,
    related: await pickRelatedProducts(product, PRODUCT_PAGE_RELATED_LIMIT, candidates, live),
  };
});
