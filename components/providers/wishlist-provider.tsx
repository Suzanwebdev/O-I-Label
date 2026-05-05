"use client";

import * as React from "react";

export type WishlistItem = {
  key: string;
  slug: string;
  name: string;
  image: string;
};

const STORAGE_KEY = "oi-label-wishlist";

const WishlistContext = React.createContext<{
  items: WishlistItem[];
  count: number;
  hasItem: (key: string) => boolean;
  toggleItem: (item: WishlistItem) => boolean;
  removeItem: (key: string) => void;
  clear: () => void;
} | null>(null);

function loadWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WishlistItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is WishlistItem =>
        Boolean(
          row &&
            typeof row === "object" &&
            typeof row.key === "string" &&
            typeof row.slug === "string" &&
            typeof row.name === "string" &&
            typeof row.image === "string"
        )
    );
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setItems(loadWishlist());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const hasItem = React.useCallback(
    (key: string) => items.some((item) => item.key === key),
    [items]
  );

  const toggleItem = React.useCallback((item: WishlistItem) => {
    let added = false;
    setItems((prev) => {
      const exists = prev.some((row) => row.key === item.key);
      if (exists) return prev.filter((row) => row.key !== item.key);
      added = true;
      return [item, ...prev];
    });
    return added;
  }, []);

  const removeItem = React.useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const value = React.useMemo(
    () => ({
      items,
      count: items.length,
      hasItem,
      toggleItem,
      removeItem,
      clear,
    }),
    [items, hasItem, toggleItem, removeItem, clear]
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = React.useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}

