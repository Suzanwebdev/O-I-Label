/** Service-role read of restock preference rows for admin demand analytics. */

import { pickProductImageFromJoin } from "@/lib/admin/order-item-image";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  aggregateRestockDemand,
  buildRestockDemandOverview,
  type RestockDemandMultiProductRow,
  type RestockDemandOverviewProduct,
  type RestockDemandPreferenceRow,
  type RestockDemandSummary,
} from "@/lib/restock-notifications/demand-analytics";
import { isValidProductId } from "@/lib/restock-notifications/helpers";

/** Select only preference + status fields — never emails or tokens. */
const DEMAND_SELECT = "preferred_color, preferred_size, status";
const OVERVIEW_SELECT = "product_id, preferred_color, preferred_size, status";

export type { RestockDemandOverviewProduct };

function mapPreferenceRow(row: {
  preferred_color?: unknown;
  preferred_size?: unknown;
  status?: unknown;
}): RestockDemandPreferenceRow {
  return {
    preferred_color: typeof row.preferred_color === "string" ? row.preferred_color : null,
    preferred_size: typeof row.preferred_size === "string" ? row.preferred_size : null,
    status: typeof row.status === "string" ? row.status : "",
  };
}

export async function loadRestockDemandPreferenceRows(
  productId: string
): Promise<RestockDemandPreferenceRow[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("restock_subscriptions")
    .select(DEMAND_SELECT)
    .eq("product_id", productId);

  if (error) {
    throw new Error(error.message || "Failed to load restock demand");
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(mapPreferenceRow);
}

/**
 * One query: all subscription preference rows (no emails).
 * Aggregation + product enrichment happen in memory / a second product lookup by IDs.
 */
export async function loadRestockDemandOverviewRows(): Promise<RestockDemandMultiProductRow[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service.from("restock_subscriptions").select(OVERVIEW_SELECT);

  if (error) {
    throw new Error(error.message || "Failed to load restock demand overview");
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    product_id: typeof row.product_id === "string" ? row.product_id : "",
    ...mapPreferenceRow(row),
  }));
}

async function loadProductMetaForIds(
  productIds: string[]
): Promise<
  Map<
    string,
    { name: string; slug: string; categoryName: string; imagePath: string | null }
  >
> {
  const map = new Map<
    string,
    { name: string; slug: string; categoryName: string; imagePath: string | null }
  >();
  if (!productIds.length) return map;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("products")
    .select(
      `
      id, name, slug,
      categories!products_category_id_fkey ( name ),
      product_images ( storage_path, sort_order )
    `
    )
    .in("id", productIds);

  if (error) {
    throw new Error(error.message || "Failed to load product metadata for demand overview");
  }

  for (const row of data ?? []) {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const imagePath = pickProductImageFromJoin({
      product_images: row.product_images,
    });
    map.set(String(row.id), {
      name: typeof row.name === "string" ? row.name : "Unknown product",
      slug: typeof row.slug === "string" ? row.slug : "",
      categoryName:
        category && typeof (category as { name?: unknown }).name === "string"
          ? (category as { name: string }).name
          : "Uncategorized",
      imagePath,
    });
  }

  return map;
}

export async function getRestockDemandSummaryForProduct(
  productId: string
): Promise<RestockDemandSummary | { error: string }> {
  if (!isValidProductId(productId)) {
    return { error: "Invalid productId" };
  }
  try {
    const rows = await loadRestockDemandPreferenceRows(productId);
    return aggregateRestockDemand(productId, rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load restock demand";
    return { error: message };
  }
}

/**
 * Admin overview: products with active waiting demand, enriched with catalog fields.
 * Uses two server queries total (subscriptions + products.in(ids)) — never one request per product.
 */
export async function getRestockDemandOverview(): Promise<
  RestockDemandOverviewProduct[] | { error: string }
> {
  try {
    const rows = await loadRestockDemandOverviewRows();
    const overview = buildRestockDemandOverview(rows);
    const meta = await loadProductMetaForIds(overview.map((item) => item.productId));

    return overview.map((item) => {
      const product = meta.get(item.productId);
      return {
        ...item,
        productName: product?.name ?? "Unknown product",
        productSlug: product?.slug ?? "",
        categoryName: product?.categoryName ?? "Uncategorized",
        imagePath: product?.imagePath ?? null,
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load restock demand overview";
    return { error: message };
  }
}
