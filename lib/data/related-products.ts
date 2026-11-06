import type { Product } from "@/lib/types";
import {
  getCatalogueSnapshot,
  listProducts,
  loadLiveAvailability,
} from "@/lib/data/catalog";
import { applyLiveAvailability, type LiveAvailability } from "@/lib/catalog/variant-stock";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isPurchasable(product: Product): boolean {
  return product.is_active && product.variants.length > 0 && product.variants.some((v) => v.stock > 0);
}

async function getCollectionPeerIds(productId: string): Promise<Set<string>> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: memberships, error: memErr } = await supabase
      .from("collection_products")
      .select("collection_id")
      .eq("product_id", productId);

    if (memErr || !memberships?.length) return new Set();

    const collectionIds = memberships.map((m) => m.collection_id);
    const { data: peers, error: peerErr } = await supabase
      .from("collection_products")
      .select("product_id")
      .in("collection_id", collectionIds)
      .neq("product_id", productId);

    if (peerErr || !peers?.length) return new Set();
    return new Set(peers.map((p) => p.product_id));
  } catch {
    return new Set();
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

/**
 * First `limit` purchasable products in rank order. Live stock is read only for
 * successive batches of top-ranked candidates until enough are purchasable.
 * Returns null if live availability cannot be verified.
 */
export async function pickPurchasableInRankOrder(
  ranked: Product[],
  limit: number,
  loadLive: (productIds: string[]) => Promise<LiveAvailability | null>,
  batchSize = Math.max(limit * 2, 1)
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

/**
 * Automatic related products: collection peers → same category → shared occasions → catalog fallback.
 */
export async function getRelatedProducts(current: Product, limit = 10): Promise<Product[]> {
  const [snapshot, collectionPeers] = await Promise.all([
    getCatalogueSnapshot(),
    getCollectionPeerIds(current.id),
  ]);

  const ranked = rankRelatedCandidates(current, snapshot.products, collectionPeers);
  if (snapshot.stockIsLive) {
    return ranked.filter(isPurchasable).slice(0, limit);
  }

  const picked = await pickPurchasableInRankOrder(ranked, limit, loadLiveAvailability);
  if (picked) return picked;

  const fresh = await listProducts();
  return rankRelatedCandidates(current, fresh, collectionPeers).filter(isPurchasable).slice(0, limit);
}
