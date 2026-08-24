/** Shop Colour filter labels — basic colours customers can scan quickly. */
export const SHOP_FILTER_COLORS = [
  "Black",
  "White",
  "Ivory",
  "Pink",
  "Red",
  "Blue",
  "Green",
  "Brown",
  "Purple",
  "Yellow",
  "Orange",
  "Navy",
  "Grey",
] as const;

export type ShopFilterColor = (typeof SHOP_FILTER_COLORS)[number];

const COLOR_FAMILY_ALIASES: Record<ShopFilterColor, string[]> = {
  Black: ["black", "onyx", "ebony", "jet"],
  White: ["white"],
  Ivory: ["ivory", "cream", "ecru", "off white", "offwhite", "champagne"],
  Pink: ["pink", "blush", "rose", "fuchsia", "magenta"],
  Red: ["red", "burgundy", "wine", "maroon", "crimson", "cherry", "scarlet", "brick"],
  Blue: ["blue", "cobalt", "azure", "denim", "indigo", "teal", "turquoise"],
  Green: ["green", "olive", "emerald", "sage", "mint", "forest", "lime", "khaki"],
  Brown: ["brown", "espresso", "mocha", "chocolate", "tan", "camel", "cognac", "nude", "beige", "sand", "taupe", "coffee"],
  Purple: ["purple", "violet", "lilac", "lavender", "plum", "mauve"],
  Yellow: ["yellow", "mustard", "gold", "lemon"],
  Orange: ["orange", "rust", "terracotta", "coral", "peach", "apricot"],
  Navy: ["navy", "midnight"],
  Grey: ["grey", "gray", "charcoal", "silver", "slate", "heather", "ash"],
};

function normalizeColorName(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function hasWord(haystack: string, word: string): boolean {
  if (!word) return false;
  return new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(
    haystack
  );
}

function matchesAliases(normalizedVariant: string, aliases: string[]): boolean {
  return aliases.some((alias) => {
    const a = normalizeColorName(alias);
    if (!a) return false;
    if (normalizedVariant === a) return true;
    if (a.includes(" ")) return normalizedVariant.includes(a);
    return hasWord(normalizedVariant, a);
  });
}

function resolveFilterColor(filter: string): ShopFilterColor | null {
  const n = normalizeColorName(filter);
  return SHOP_FILTER_COLORS.find((c) => normalizeColorName(c) === n) ?? null;
}

export function variantMatchesShopColorFilter(variantColor: string | null | undefined, filter: string): boolean {
  if (!variantColor?.trim() || !filter.trim()) return false;
  const normalized = normalizeColorName(variantColor);
  const family = resolveFilterColor(filter);

  if (!family) {
    const f = normalizeColorName(filter);
    return normalized === f || hasWord(normalized, f);
  }

  if (family === "Blue" && matchesAliases(normalized, COLOR_FAMILY_ALIASES.Navy)) {
    return false;
  }
  if (family === "White" && matchesAliases(normalized, COLOR_FAMILY_ALIASES.Ivory)) {
    return false;
  }

  return matchesAliases(normalized, COLOR_FAMILY_ALIASES[family]);
}

export function variantMatchesAnyShopColorFilter(
  variantColor: string | null | undefined,
  filters: string[]
): boolean {
  return filters.some((filter) => variantMatchesShopColorFilter(variantColor, filter));
}
