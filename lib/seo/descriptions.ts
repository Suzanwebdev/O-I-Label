import type { Product } from "@/lib/types";

export function buildProductSeoTitle(product: {
  name: string;
  seo_title?: string | null;
}): string {
  const raw = product.seo_title?.trim() || product.name.trim();
  return raw.slice(0, 120);
}

export function buildProductDescription(product: Product): string {
  const custom = product.seo_description?.trim();
  if (custom) return custom.slice(0, 320);

  const trimmed = product.description.trim();
  if (trimmed.length >= 40) return trimmed.slice(0, 320);

  const prices = product.variants.map((v) => v.price_ghs).filter(Number.isFinite);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const category = product.category_name.toLowerCase();

  const pricePart = minPrice != null ? ` From GHS ${minPrice.toFixed(0)}.` : "";
  const generated = `Shop ${product.name} at O & I Label — premium women's ${category}, luxury dresses, and statement looks for modern wardrobes.${pricePart}`;

  return (trimmed || generated).slice(0, 320);
}

const CATEGORY_COPY: Record<
  string,
  { description: string; keywords: string[] }
> = {
  dresses: {
    description:
      "Explore premium dresses at O & I Label — bodycon silhouettes, midi lengths, and elevated evening looks for women's fashion.",
    keywords: ["women's dresses", "luxury dresses", "bodycon dresses", "midi dresses"],
  },
  "two-piece-sets": {
    description:
      "Shop coordinated two-piece sets at O & I Label — polished tops and skirts with premium feminine tailoring.",
    keywords: ["two-piece sets", "co-ord sets", "women's matching sets"],
  },
  tops: {
    description:
      "Discover premium tops at O & I Label — clean necklines, refined fabrics, and versatile wardrobe essentials.",
    keywords: ["women's tops", "premium tops", "feminine tops"],
  },
  bottoms: {
    description:
      "Shop women's bottoms at O & I Label — tailored trousers, skirts, and flattering silhouettes.",
    keywords: ["women's bottoms", "skirts", "trousers"],
  },
  "new-arrivals": {
    description:
      "See the latest new arrivals at O & I Label — fresh premium women's fashion drops and statement pieces.",
    keywords: ["new arrivals", "new in fashion", "latest women's fashion"],
  },
};

export function buildCategoryDescription(category: {
  slug: string;
  name: string;
  description?: string | null;
}): string {
  const fromDb = category.description?.trim();
  if (fromDb && fromDb.length >= 40) return fromDb.slice(0, 320);
  const preset = CATEGORY_COPY[category.slug];
  if (preset) return preset.description;
  return `Shop ${category.name} at O & I Label — premium women's fashion, luxury dresses, and modern wardrobe essentials online in Ghana.`.slice(
    0,
    320
  );
}

export function buildCategoryKeywords(category: { slug: string; name: string }): string[] {
  const preset = CATEGORY_COPY[category.slug];
  const base = [
    category.name,
    `${category.name} O & I Label`,
    "women's fashion",
    "premium fashion",
    "Ghana fashion",
  ];
  return preset ? [...base, ...preset.keywords] : base;
}
