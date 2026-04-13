/**
 * Seed Supabase with O & I Label demo categories + 30 products from lib/mock-data.
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/seed.ts
 */
import { createClient } from "@supabase/supabase-js";
import { mockCategories, mockProducts } from "../lib/mock-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  for (const c of mockCategories) {
    const { error } = await supabase.from("categories").upsert(
      { slug: c.slug, name: c.name, description: c.description ?? null },
      { onConflict: "slug" }
    );
    if (error) throw error;
  }

  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, slug");
  if (catErr) throw catErr;
  const slugToId = new Map(cats!.map((r) => [r.slug, r.id]));

  for (const p of mockProducts) {
    const categoryId = slugToId.get(p.category_slug) ?? null;

    const { data: prod, error: pe } = await supabase
      .from("products")
      .upsert(
        {
          slug: p.slug,
          name: p.name,
          description: p.description,
          category_id: categoryId,
          is_active: p.is_active,
          badges: p.badges,
          rating: p.rating ?? null,
          review_count: p.review_count ?? 0,
          seo_title: p.name,
          seo_description: p.description.slice(0, 155),
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (pe) throw pe;
    const productId = prod!.id;

    await supabase.from("product_images").delete().eq("product_id", productId);
    for (let i = 0; i < p.images.length; i++) {
      const { error: ie } = await supabase.from("product_images").insert({
        product_id: productId,
        storage_path: p.images[i],
        sort_order: i,
        alt: p.name,
      });
      if (ie) throw ie;
    }

    await supabase.from("variants").delete().eq("product_id", productId);
    for (const v of p.variants) {
      const { error: ve } = await supabase.from("variants").insert({
        product_id: productId,
        sku: v.sku,
        price_ghs: v.price_ghs,
        compare_at_ghs: v.compare_at_ghs ?? null,
        stock: v.stock,
        size: v.size ?? null,
        color: v.color ?? null,
      });
      if (ve) throw ve;
    }
  }

  console.log("Seed complete:", mockProducts.length, "products");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
