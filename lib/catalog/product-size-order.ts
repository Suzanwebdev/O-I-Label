/** Canonical ascending order for storefront size labels. */

const LETTER_SIZE_RANK: Record<string, number> = {
  XXS: 0,
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
  "2XL": 6,
  "3XL": 7,
  "4XL": 8,
  "5XL": 9,
};

function normalizeSizeLabel(size: string): string {
  return size.trim().toUpperCase();
}

function parseNumericSize(size: string): number | null {
  const trimmed = size.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare two size labels for display order:
 * letter sizes XXS→5XL, then numeric sizes ascending (6, 8, 10…),
 * then any other labels alphabetically.
 */
export function compareProductSizes(a: string, b: string): number {
  const na = normalizeSizeLabel(a);
  const nb = normalizeSizeLabel(b);
  if (na === nb) return a.localeCompare(b);

  const letterA = LETTER_SIZE_RANK[na];
  const letterB = LETTER_SIZE_RANK[nb];
  const numA = parseNumericSize(a);
  const numB = parseNumericSize(b);

  const group = (letter: number | undefined, num: number | null) => {
    if (letter != null) return 0;
    if (num != null) return 1;
    return 2;
  };

  const groupA = group(letterA, numA);
  const groupB = group(letterB, numB);
  if (groupA !== groupB) return groupA - groupB;

  if (groupA === 0) return (letterA as number) - (letterB as number);
  if (groupA === 1) return (numA as number) - (numB as number);
  return na.localeCompare(nb);
}

/** Unique non-empty sizes in ascending display order. */
export function sortProductSizes(sizes: ReadonlyArray<string | null | undefined>): string[] {
  const unique = Array.from(
    new Set(
      sizes
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
    )
  );
  return unique.sort(compareProductSizes);
}
