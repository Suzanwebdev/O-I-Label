/** Read-only restock demand aggregation for admin analytics (Phase 4). */

import type { RestockSubscriptionStatus } from "@/lib/restock-notifications/helpers";

export type RestockDemandPreferenceRow = {
  preferred_color: string | null;
  preferred_size: string | null;
  status: string;
};

export type RestockDemandBucket = {
  /** Stored preference value; null means Any. */
  value: string | null;
  label: string;
  count: number;
};

export type RestockDemandCombination = {
  color: string | null;
  size: string | null;
  colorLabel: string;
  sizeLabel: string;
  count: number;
};

export type RestockDemandActiveSummary = {
  total: number;
  sizes: RestockDemandBucket[];
  colors: RestockDemandBucket[];
  combinations: RestockDemandCombination[];
};

export type RestockDemandHistoricalSummary = {
  notified: number;
  unsubscribedOrCancelled: number;
};

export type RestockDemandSummary = {
  productId: string;
  active: RestockDemandActiveSummary;
  historical: RestockDemandHistoricalSummary;
};

const ANY_LABEL = "Any";

/** NULL / blank / "any" → Any for display; does not mutate DB. */
export function preferenceDisplayValue(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "any") return null;
  return trimmed;
}

export function preferenceLabel(value: string | null): string {
  return value ?? ANY_LABEL;
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function sortBuckets(entries: Iterable<[string, number]>): RestockDemandBucket[] {
  return [...entries]
    .map(([key, count]) => {
      const value = key === "" ? null : key;
      return { value, label: preferenceLabel(value), count };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function sortCombinations(
  entries: Iterable<[string, number]>
): RestockDemandCombination[] {
  return [...entries]
    .map(([key, count]) => {
      const [colorKey = "", sizeKey = ""] = key.split("\0");
      const color = colorKey === "" ? null : colorKey;
      const size = sizeKey === "" ? null : sizeKey;
      return {
        color,
        size,
        colorLabel: preferenceLabel(color),
        sizeLabel: preferenceLabel(size),
        count,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.colorLabel.localeCompare(b.colorLabel) ||
        a.sizeLabel.localeCompare(b.sizeLabel)
    );
}

function emptyActive(): RestockDemandActiveSummary {
  return { total: 0, sizes: [], colors: [], combinations: [] };
}

/**
 * Aggregate preference demand from subscription preference rows.
 * Only status === 'active' counts toward current waiting demand.
 * Does not include or require email fields.
 */
export function aggregateRestockDemand(
  productId: string,
  rows: ReadonlyArray<RestockDemandPreferenceRow>
): RestockDemandSummary {
  let notified = 0;
  let unsubscribedOrCancelled = 0;
  const sizeCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();
  const comboCounts = new Map<string, number>();
  let activeTotal = 0;

  for (const row of rows) {
    const status = row.status as RestockSubscriptionStatus | string;
    if (status === "notified") {
      notified += 1;
      continue;
    }
    if (status === "unsubscribed" || status === "cancelled") {
      unsubscribedOrCancelled += 1;
      continue;
    }
    if (status !== "active") continue;

    activeTotal += 1;
    const color = preferenceDisplayValue(row.preferred_color);
    const size = preferenceDisplayValue(row.preferred_size);
    bump(colorCounts, color ?? "");
    bump(sizeCounts, size ?? "");
    bump(comboCounts, `${color ?? ""}\0${size ?? ""}`);
  }

  return {
    productId,
    active:
      activeTotal === 0
        ? emptyActive()
        : {
            total: activeTotal,
            sizes: sortBuckets(sizeCounts),
            colors: sortBuckets(colorCounts),
            combinations: sortCombinations(comboCounts),
          },
    historical: { notified, unsubscribedOrCancelled },
  };
}

export type RestockDemandMultiProductRow = RestockDemandPreferenceRow & {
  product_id: string;
};

export type RestockDemandOverviewItem = {
  productId: string;
  waiting: number;
  topSize: RestockDemandBucket | null;
  topColor: RestockDemandBucket | null;
  topCombination: RestockDemandCombination | null;
  /** Full per-product summary (active + historical) for detail expand. */
  demand: RestockDemandSummary;
};

export type RestockDemandOverviewProduct = RestockDemandOverviewItem & {
  productName: string;
  productSlug: string;
  categoryName: string;
  imagePath: string | null;
};

/**
 * Build an overview of products with CURRENT active demand only.
 * Sorted by active waiting count descending. Products with zero active are omitted.
 * Reuses aggregateRestockDemand — does not change aggregation rules.
 */
export function buildRestockDemandOverview(
  rows: ReadonlyArray<RestockDemandMultiProductRow>
): RestockDemandOverviewItem[] {
  const byProduct = new Map<string, RestockDemandPreferenceRow[]>();

  for (const row of rows) {
    const productId = typeof row.product_id === "string" ? row.product_id.trim() : "";
    if (!productId) continue;
    const list = byProduct.get(productId) ?? [];
    list.push({
      preferred_color: row.preferred_color,
      preferred_size: row.preferred_size,
      status: row.status,
    });
    byProduct.set(productId, list);
  }

  const items: RestockDemandOverviewItem[] = [];
  for (const [productId, prefs] of byProduct) {
    const demand = aggregateRestockDemand(productId, prefs);
    if (demand.active.total <= 0) continue;
    items.push({
      productId,
      waiting: demand.active.total,
      topSize: demand.active.sizes[0] ?? null,
      topColor: demand.active.colors[0] ?? null,
      topCombination: demand.active.combinations[0] ?? null,
      demand,
    });
  }

  return items.sort(
    (a, b) => b.waiting - a.waiting || a.productId.localeCompare(b.productId)
  );
}

/** Client/server search filter for overview rows (name, slug, category). */
export function filterRestockDemandOverview<
  T extends { productName: string; productSlug: string; categoryName: string },
>(items: ReadonlyArray<T>, query: string, categoryKey?: string): T[] {
  const q = query.trim().toLowerCase();
  const cat = (categoryKey ?? "all").trim();
  return items.filter((item) => {
    const matchesCategory =
      cat === "all" ||
      cat === "" ||
      item.categoryName.toLowerCase() === cat.toLowerCase();
    if (!matchesCategory) return false;
    if (!q) return true;
    return (
      item.productName.toLowerCase().includes(q) ||
      item.productSlug.toLowerCase().includes(q) ||
      item.categoryName.toLowerCase().includes(q)
    );
  });
}
