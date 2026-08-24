import type { Product, ProductBadge, ProductVariant } from "@/lib/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

async function extraCategorySlugsByProductId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  productIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!productIds.length) return map;
  const { data, error } = await supabase
    .from("product_categories")
    .select("product_id, categories!product_categories_category_id_fkey ( slug )")
    .in("product_id", productIds);
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

export async function listProducts(): Promise<Product[]> {
  try {
    const supabase = await createServerSupabaseClient();
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

    if (error || !data?.length) return [];
    const extras = await extraCategorySlugsByProductId(
      supabase,
      (data as { id: string }[]).map((row) => row.id)
    );
    return (data as unknown as DbProduct[]).map((row) => mapRow(row, extras.get(row.id) ?? []));
  } catch {
    return [];
  }
}

export async function getProductBySlugFromDb(
  slug: string
): Promise<Product | null> {
  const normalized = slug.trim();
  if (!normalized) return null;

  try {
    const supabase = await createServerSupabaseClient();
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
      .eq("slug", normalized)
      .eq("is_active", true)
      .maybeSingle();

    if (!error && data) {
      const extras = await extraCategorySlugsByProductId(supabase, [(data as { id: string }).id]);
      return mapRow(data as unknown as DbProduct, extras.get((data as { id: string }).id) ?? []);
    }
  } catch {
    /* no mock fallback — only real catalog rows */
  }

  return null;
}

export async function listCategoriesFromDb(): Promise<
  { slug: string; name: string; description?: string | null; image_url?: string | null }[]
> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("slug, name, description, image_url")
      .order("sort_order", { ascending: true });
    if (error || !data?.length) {
      const { mockCategories } = await import("@/lib/mock-data");
      return mockCategories;
    }
    return data;
  } catch {
    const { mockCategories } = await import("@/lib/mock-data");
    return mockCategories;
  }
}
