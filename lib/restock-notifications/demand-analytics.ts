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
