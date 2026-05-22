import type { CartLine } from "@/lib/types";

const BUY_NOW_KEY = "oi-label-buy-now";

function coerce(line: CartLine): CartLine {
  return { ...line, selected: true };
}

export function readBuyNowLines(): CartLine[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BUY_NOW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CartLine[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed.filter(Boolean).map((l) => coerce(l as CartLine));
  } catch {
    return null;
  }
}

export function writeBuyNowLines(lines: CartLine[]): void {
  if (typeof window === "undefined") return;
  const normalized = lines.map((l) => coerce(l));
  sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify(normalized));
}

export function clearBuyNowLines(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(BUY_NOW_KEY);
}
