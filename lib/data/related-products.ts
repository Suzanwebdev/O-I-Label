import type { Product } from "@/lib/types";
import { listProducts } from "@/lib/data/catalog";
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

/**
 * Automatic related products: collection peers → same category → shared occasions → catalog fallback.
 */
export async function getRelatedProducts(current: Product, limit = 16): Promise<Product[]> {
  const [catalog, collectionPeers] = await Promise.all([
    listProducts(),
    getCollectionPeerIds(current.id),
  ]);

  const candidates = catalog.filter((p) => p.id !== current.id && isPurchasable(p));

  const ranked = candidates
    .map((product) => ({
      product,
      score: scoreRelatedProduct(current, product, collectionPeers),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.product.name.localeCompare(b.product.name);
    });

  const withSignal = ranked.filter((r) => r.score > 0);
  const pool = withSignal.length >= limit ? withSignal : ranked;

  return pool.slice(0, limit).map((r) => r.product);
}
