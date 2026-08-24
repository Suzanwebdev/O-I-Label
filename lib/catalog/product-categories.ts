const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseExtraCategoryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function mergeProductCategoryIds(primaryId: string, extraIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [primaryId, ...extraIds]) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function productBelongsToCategorySlug(
  product: { category_slug: string; category_slugs?: string[] },
  slug: string
): boolean {
  if (product.category_slugs?.length) return product.category_slugs.includes(slug);
  return product.category_slug === slug;
}
