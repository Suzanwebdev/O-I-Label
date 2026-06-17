import type { StorefrontProduct } from "@/lib/catalog/storefront-product";
import { isVariantInStock } from "@/lib/catalog/storefront-product";
import type { OccasionTag, Product, ProductBadge } from "@/lib/types";

const OCCASION_TAGS: OccasionTag[] = [
  "birthday",
  "vacation",
  "wedding",
  "corporate",
];

/** Lowercase slug from `?occasion=`; rejects unknown values so callers can show an empty grid. */
export function occasionFromQueryParam(raw: string): OccasionTag | undefined {
  const k = raw.trim().toLowerCase() as OccasionTag;
  return OCCASION_TAGS.includes(k) ? k : undefined;
}

type CatalogProduct = StorefrontProduct | Product;

export function filterProducts<T extends CatalogProduct>(
  products: T[],
  opts: {
    q?: string;
    category?: string;
    occasion?: string;
    tag?: string;
    minPrice?: number;
    maxPrice?: number;
    sizes?: string[];
    colors?: string[];
    inStockOnly?: boolean;
  }
) {
  let list = [...products];
  if (opts.q?.trim()) {
    const q = opts.q.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }
  if (opts.category) {
    list = list.filter((p) => p.category_slug === opts.category);
  }
  const occasionRaw = opts.occasion?.trim();
  if (occasionRaw) {
    const occasionKey = occasionFromQueryParam(occasionRaw);
    if (occasionKey) {
      list = list.filter((p) => (p.occasions ?? []).includes(occasionKey));
    } else {
      list = [];
    }
  }
  if (opts.tag) {
    const t = opts.tag as ProductBadge;
    list = list.filter((p) => p.badges.includes(t));
  }
  if (opts.minPrice != null) {
    list = list.filter(
      (p) => Math.min(...p.variants.map((v) => v.price_ghs)) >= opts.minPrice!
    );
  }
  if (opts.maxPrice != null) {
    list = list.filter(
      (p) => Math.min(...p.variants.map((v) => v.price_ghs)) <= opts.maxPrice!
    );
  }
  if (opts.sizes?.length) {
    list = list.filter((p) =>
      p.variants.some((v) => v.size && opts.sizes!.includes(v.size))
    );
  }
  if (opts.colors?.length) {
    list = list.filter((p) =>
      p.variants.some((v) => v.color && opts.colors!.includes(v.color))
    );
  }
  if (opts.inStockOnly) {
    list = list.filter((p) => p.variants.some((v) => isVariantInStock(v)));
  }
  return list;
}

export function sortProducts<T extends CatalogProduct>(
  products: T[],
  sort: string
): T[] {
  const list = [...products];
  switch (sort) {
    case "price_asc":
      return list.sort(
        (a, b) =>
          Math.min(...a.variants.map((v) => v.price_ghs)) -
          Math.min(...b.variants.map((v) => v.price_ghs))
      );
    case "price_desc":
      return list.sort(
        (a, b) =>
          Math.min(...b.variants.map((v) => v.price_ghs)) -
          Math.min(...a.variants.map((v) => v.price_ghs))
      );
    case "newest":
      return list.reverse();
    case "rated":
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "best_sellers":
    default:
      return list.sort((a, b) => {
        const ab = a.badges.includes("best_seller") ? 1 : 0;
        const bb = b.badges.includes("best_seller") ? 1 : 0;
        return bb - ab;
      });
  }
}

export const HOME_BEST_SELLERS_BATCH = 12;

/** Tagged best sellers first, then popular products for homepage “Show more” batches. */
export function buildHomeBestSellersList(products: Product[]): Product[] {
  const withVariants = products.filter((p) => p.variants.length > 0);
  const tagged = filterProducts(withVariants, { tag: "best_seller" });
  const ranked = sortProducts(withVariants, "best_sellers");
  const seen = new Set<string>();
  const list: Product[] = [];

  for (const p of tagged) {
    if (!seen.has(p.id)) {
      list.push(p);
      seen.add(p.id);
    }
  }
  for (const p of ranked) {
    if (!seen.has(p.id)) {
      list.push(p);
      seen.add(p.id);
    }
  }
  return list;
}
