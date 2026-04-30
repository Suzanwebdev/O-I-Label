import type { OccasionItem } from "@/components/home/occasion-section";

export type ShopOccasionKey = "birthday" | "vacation" | "wedding" | "corporate";

export const SHOP_OCCASION_KEYS: ShopOccasionKey[] = [
  "birthday",
  "vacation",
  "wedding",
  "corporate",
];

export const OCCASION_CARDS_LIMIT = 24;

const DEFAULT_BY_KEY: Record<ShopOccasionKey, OccasionItem> = {
  birthday: {
    title: "Birthday",
    href: "/shop?occasion=birthday",
    image:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1260&h=1680&fit=crop&q=85",
    alt: "Birthday occasion - elevated dress moment",
  },
  vacation: {
    title: "Vacation",
    href: "/shop?occasion=vacation",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1260&h=1680&fit=crop&q=85",
    alt: "Vacation edit - resort-ready pieces",
  },
  wedding: {
    title: "Wedding",
    href: "/shop?occasion=wedding",
    image: "/home/occasion-wedding.png",
    alt: "Wedding occasion dressing",
    imageClassName: "object-cover object-[center_66%] scale-[1.08] group-hover:scale-[1.11]",
  },
  corporate: {
    title: "Corporate",
    href: "/shop?occasion=corporate",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1260&h=1680&fit=crop&q=85",
    alt: "Corporate and workwear occasion dressing",
  },
};

/** Stored record: id uniquely identifies the row. preset_key merges empty fields with built-in presets. */
export type OccasionSectionCardStored = {
  id: string;
  preset_key?: ShopOccasionKey;
  title?: string;
  href?: string;
  image_url?: string;
  alt?: string;
  image_class_name?: string;
};

function isOccasionKey(v: unknown): v is ShopOccasionKey {
  return v === "birthday" || v === "vacation" || v === "wedding" || v === "corporate";
}

const PRESET_ID_PREFIX = "preset-";

export function presetRowId(key: ShopOccasionKey): string {
  return `${PRESET_ID_PREFIX}${key}`;
}

export function presetKeyFromRowId(id: string): ShopOccasionKey | undefined {
  if (!id.startsWith(PRESET_ID_PREFIX)) return undefined;
  const k = id.slice(PRESET_ID_PREFIX.length);
  return isOccasionKey(k) ? k : undefined;
}

function safeStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Parses `home_content.sections.shop_by_occasion.cards` (new ids + preset_key or legacy keyed rows).
 */
export function parseStoredOccasionCards(sections: unknown): OccasionSectionCardStored[] {
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) return [];
  const sob = (sections as Record<string, unknown>)["shop_by_occasion"];
  if (!sob || typeof sob !== "object" || Array.isArray(sob)) return [];
  const raw = (sob as Record<string, unknown>)["cards"];
  if (!Array.isArray(raw)) return [];

  const out: OccasionSectionCardStored[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    let id = safeStr(r["id"])?.trim() ?? "";

    const keyField = r["preset_key"] ?? r["key"];
    let presetKey = isOccasionKey(keyField) ? keyField : undefined;

    if (!id && presetKey) id = presetRowId(presetKey);
    if (!id) continue;
    if (!presetKey && id.startsWith(PRESET_ID_PREFIX)) {
      const inferred = id.slice(PRESET_ID_PREFIX.length);
      if (isOccasionKey(inferred)) presetKey = inferred;
    }

    out.push({
      id,
      ...(presetKey ? { preset_key: presetKey } : {}),
      title: safeStr(r["title"]),
      href: safeStr(r["href"]),
      image_url: safeStr(r["image_url"]),
      alt: safeStr(r["alt"]),
      image_class_name: safeStr(r["image_class_name"]),
    });
  }
  return out;
}

export function defaultPresetOccasionItem(key: ShopOccasionKey): OccasionItem {
  return { ...DEFAULT_BY_KEY[key] };
}

export function defaultShopOccasionItem(key: ShopOccasionKey): OccasionItem {
  return defaultPresetOccasionItem(key);
}

/** @deprecated renamed */
export function parseStoredShopOccasionCards(sections: unknown): OccasionSectionCardStored[] {
  return parseStoredOccasionCards(sections);
}

export function presetShellStarterCards(): OccasionSectionCardStored[] {
  return SHOP_OCCASION_KEYS.map((k) => ({ id: presetRowId(k), preset_key: k }));
}

export function editorInitialOccasionCards(sections: unknown): OccasionSectionCardStored[] {
  const parsed = parseStoredOccasionCards(sections);
  if (parsed.length > 0) return parsed;
  return presetShellStarterCards();
}

function resolvedOccasionItem(card: OccasionSectionCardStored): OccasionItem | null {
  const base = card.preset_key ? DEFAULT_BY_KEY[card.preset_key] : null;

  const titleRaw = typeof card.title === "string" ? card.title.trim() : "";
  const hrefRaw = typeof card.href === "string" ? card.href.trim() : "";
  const imageRaw = typeof card.image_url === "string" ? card.image_url.trim() : "";
  const altRaw = typeof card.alt === "string" ? card.alt.trim() : "";
  const clsRaw =
    typeof card.image_class_name === "string" && card.image_class_name.trim()
      ? card.image_class_name.trim()
      : undefined;

  if (base) {
    const title = titleRaw || base.title;
    const href = hrefRaw || base.href;
    const img = imageRaw || base.image;
    const alt = altRaw || base.alt;
    const imageClassName = clsRaw ?? base.imageClassName;
    const item: OccasionItem = { title, href, image: img, alt };
    if (imageClassName) item.imageClassName = imageClassName;
    return item;
  }

  if (!titleRaw || !hrefRaw || !imageRaw) return null;

  const item: OccasionItem = { title: titleRaw, href: hrefRaw, image: imageRaw };
  if (altRaw) item.alt = altRaw;
  if (clsRaw) item.imageClassName = clsRaw;
  return item;
}

function defaultCarouselItems(): OccasionItem[] {
  return SHOP_OCCASION_KEYS.map((k) => ({ ...DEFAULT_BY_KEY[k] }));
}

/** Homepage: unresolved / empty shop_by_occasion → four built-ins; configured list drives order and extras. */
export function occasionItemsFromSections(sections: unknown): OccasionItem[] {
  const cards = parseStoredOccasionCards(sections);
  if (cards.length === 0) return defaultCarouselItems();

  const mapped = cards.map(resolvedOccasionItem).filter((x): x is OccasionItem => x !== null);
  return mapped.length > 0 ? mapped : defaultCarouselItems();
}

/** @deprecated Alias for older imports */
export function mergeShopOccasionItemsFromSections(sections: unknown): OccasionItem[] {
  return occasionItemsFromSections(sections);
}

/** @deprecated Use editorInitialOccasionCards */
export function normalizedStoredShopOccasionCards(sections: unknown): OccasionSectionCardStored[] {
  return editorInitialOccasionCards(sections);
}

/** @deprecated Prefer OccasionSectionCardStored */
export type ShopOccasionCardStored = OccasionSectionCardStored;
