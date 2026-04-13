import type { Product, ProductBadge, ProductVariant } from "@/lib/types";
import { mockProducts } from "@/lib/mock-data";
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
  is_active: boolean;
  badges: string[] | null;
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

function mapRow(row: DbProduct): Product {
  const imgs = (row.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((i) => i.storage_path);
  const variants = (row.variants ?? []).map(mapVariant);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    category_slug: row.categories?.slug ?? "new-arrivals",
    category_name: row.categories?.name ?? "New Arrivals",
    images: imgs.length ? imgs : ["/file.svg"],
    badges: (row.badges ?? []) as ProductBadge[],
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
        id, slug, name, description, is_active, badges, rating, review_count,
        categories ( slug, name ),
        variants ( id, sku, price_ghs, compare_at_ghs, stock, size, color ),
        product_images ( storage_path, sort_order )
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error || !data?.length) return mockProducts;
    return (data as unknown as DbProduct[]).map(mapRow);
  } catch {
    return mockProducts;
  }
}

export async function getProductBySlugFromDb(
  slug: string
): Promise<Product | null> {
  const all = await listProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function listCategoriesFromDb(): Promise<
  { slug: string; name: string; description?: string | null }[]
> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("slug, name, description")
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
