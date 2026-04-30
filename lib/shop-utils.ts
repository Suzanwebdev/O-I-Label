import type { Product, ProductBadge } from "@/lib/types";

export function filterProducts(
  products: Product[],
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
  if (opts.occasion) {
    list = list.filter((p) => (p.occasions ?? []).includes(opts.occasion as "birthday" | "vacation" | "wedding" | "corporate"));
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
    list = list.filter((p) => p.variants.some((v) => v.stock > 0));
  }
  return list;
}

export function sortProducts(
  products: Product[],
  sort: string
): Product[] {
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
