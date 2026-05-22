"use client";

import * as React from "react";
import {
  clearBuyNowLines,
  readBuyNowLines,
  writeBuyNowLines,
} from "@/lib/cart/buy-now-storage";
import type { CartLine } from "@/lib/types";

function coerceCartLine(row: CartLine): CartLine {
  return {
    ...row,
    selected: row.selected !== false,
  };
}

const CartContext = React.createContext<{
  lines: CartLine[];
  selectedLines: CartLine[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (line: CartLine) => void;
  updateQty: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
  toggleLineSelected: (variantId: string) => void;
  selectAllLines: () => void;
  deselectAllLines: () => void;
  /** After checkout: remove purchased (selected) lines; keep unchecked items in the bag. */
  removePurchasedLines: () => void;
  /** Express checkout: only these lines at checkout; saved bag is unchanged. */
  isExpressCheckout: boolean;
  beginBuyNowCheckout: (lines: CartLine[]) => void;
  clearExpressCheckout: () => void;
  subtotalGhs: number;
  bagSubtotalGhs: number;
} | null>(null);

const STORAGE_KEY = "oi-label-cart";

function loadLines(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean).map((l) => coerceCartLine(l as CartLine));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [buyNowLines, setBuyNowLines] = React.useState<CartLine[] | null>(null);
  const [isOpen, setOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setLines(loadLines());
    setBuyNowLines(readBuyNowLines());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const isExpressCheckout = buyNowLines != null && buyNowLines.length > 0;

  const selectedLines = React.useMemo(
    () =>
      isExpressCheckout
        ? buyNowLines
        : lines.filter((l) => l.selected !== false),
    [isExpressCheckout, buyNowLines, lines]
  );

  const subtotalGhs = React.useMemo(
    () => selectedLines.reduce((s, l) => s + l.unitPriceGhs * l.quantity, 0),
    [selectedLines]
  );

  const bagSubtotalGhs = React.useMemo(
    () => lines.reduce((s, l) => s + l.unitPriceGhs * l.quantity, 0),
    [lines]
  );

  const addItem = React.useCallback((line: CartLine) => {
    const normalized = coerceCartLine(line);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variantId === normalized.variantId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = {
          ...next[i],
          quantity: next[i].quantity + normalized.quantity,
        };
        return next;
      }
      return [...prev, normalized];
    });
  }, []);

  const updateQty = React.useCallback((variantId: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          l.variantId === variantId ? { ...l, quantity: Math.max(0, quantity) } : l
        )
        .filter((l) => l.quantity > 0)
    );
  }, []);

  const removeLine = React.useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = React.useCallback(() => setLines([]), []);

  const toggleLineSelected = React.useCallback((variantId: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.variantId === variantId ? { ...l, selected: !(l.selected !== false) } : l
      )
    );
  }, []);

  const selectAllLines = React.useCallback(() => {
    setLines((prev) => prev.map((l) => ({ ...l, selected: true })));
  }, []);

  const deselectAllLines = React.useCallback(() => {
    setLines((prev) => prev.map((l) => ({ ...l, selected: false })));
  }, []);

  const removePurchasedLines = React.useCallback(() => {
    setLines((prev) => prev.filter((l) => l.selected === false));
  }, []);

  const beginBuyNowCheckout = React.useCallback((next: CartLine[]) => {
    const rows = next.map((l) => coerceCartLine({ ...l, selected: true }));
    writeBuyNowLines(rows);
    setBuyNowLines(rows);
  }, []);

  const clearExpressCheckout = React.useCallback(() => {
    clearBuyNowLines();
    setBuyNowLines(null);
  }, []);

  const value = React.useMemo(
    () => ({
      lines,
      selectedLines,
      isOpen,
      openCart: () => setOpen(true),
      closeCart: () => setOpen(false),
      toggleCart: () => setOpen((o) => !o),
      addItem,
      updateQty,
      removeLine,
      clear,
      toggleLineSelected,
      selectAllLines,
      deselectAllLines,
      removePurchasedLines,
      isExpressCheckout,
      beginBuyNowCheckout,
      clearExpressCheckout,
      subtotalGhs,
      bagSubtotalGhs,
    }),
    [
      lines,
      selectedLines,
      isOpen,
      addItem,
      updateQty,
      removeLine,
      clear,
      toggleLineSelected,
      selectAllLines,
      deselectAllLines,
      removePurchasedLines,
      isExpressCheckout,
      beginBuyNowCheckout,
      clearExpressCheckout,
      subtotalGhs,
      bagSubtotalGhs,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
