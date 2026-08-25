/** Service-role read of restock preference rows for admin demand analytics. */

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  aggregateRestockDemand,
  type RestockDemandPreferenceRow,
  type RestockDemandSummary,
} from "@/lib/restock-notifications/demand-analytics";
import { isValidProductId } from "@/lib/restock-notifications/helpers";

/** Select only preference + status fields — never emails or tokens. */
const DEMAND_SELECT = "preferred_color, preferred_size, status";

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

  return ((data ?? []) as RestockDemandPreferenceRow[]).map((row) => ({
    preferred_color:
      typeof row.preferred_color === "string" ? row.preferred_color : row.preferred_color ?? null,
    preferred_size:
      typeof row.preferred_size === "string" ? row.preferred_size : row.preferred_size ?? null,
    status: typeof row.status === "string" ? row.status : "",
  }));
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
