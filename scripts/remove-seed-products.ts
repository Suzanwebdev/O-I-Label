/**
 * Remove demo/seed products from Supabase (scripts/seed.ts catalog only).
 * Usage: npx tsx scripts/remove-seed-products.ts
 */
import { createClient } from "@supabase/supabase-js";
import { SEED_PRODUCT_SLUGS } from "../lib/mock-data";

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
  const { data: matches, error: listErr } = await supabase
    .from("products")
    .select("id, slug, name")
    .in("slug", [...SEED_PRODUCT_SLUGS]);

  if (listErr) throw listErr;

  const toDelete = matches ?? [];
  console.log(`Found ${toDelete.length} seed product(s) to remove.`);

  if (!toDelete.length) {
    const { count } = await supabase.from("products").select("id", { count: "exact", head: true });
    console.log(`Remaining products in catalog: ${count ?? 0}`);
    return;
  }

  for (const row of toDelete) {
    console.log(`  - ${row.slug} (${row.name})`);
  }

  const { error: delErr } = await supabase
    .from("products")
    .delete()
    .in("slug", [...SEED_PRODUCT_SLUGS]);

  if (delErr) throw delErr;

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true });
  console.log(`Removed ${toDelete.length} seed product(s). Remaining: ${count ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
