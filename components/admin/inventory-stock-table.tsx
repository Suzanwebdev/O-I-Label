"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminInventoryRow } from "@/lib/data/admin";
import { InventoryStockCell } from "@/components/admin/inventory-stock-cell";

const UNCATEGORIZED = "__uncategorized__";

export function InventoryStockTable({ rows }: { rows: AdminInventoryRow[] }) {
  const [query, setQuery] = React.useState("");
  const [categoryKey, setCategoryKey] = React.useState<string>("all");

  const categoryOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const key = r.category_slug ?? UNCATEGORIZED;
      const label = r.category_slug ? (r.category_name ?? r.category_slug) : "Uncategorized";
      if (!map.has(key)) map.set(key, label);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = React.useMemo(() => {
    let list = rows;
    if (categoryKey !== "all") {
      if (categoryKey === UNCATEGORIZED) {
        list = list.filter((r) => r.category_slug == null || r.category_slug === "");
      } else {
        list = list.filter((r) => r.category_slug === categoryKey);
      }
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        r.product_slug.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        (r.category_name ?? "").toLowerCase().includes(q)
    );
  }, [rows, query, categoryKey]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end sm:gap-6 lg:max-w-3xl">
        <div className="space-y-1.5">
          <Label htmlFor="inventory-category">Category</Label>
          <Select value={categoryKey} onValueChange={setCategoryKey}>
            <SelectTrigger id="inventory-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inventory-search">Search products or SKUs</Label>
          <Input
            id="inventory-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. ribbed-top, satin, BLK-M-001..."
            autoComplete="off"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} variant{filtered.length === 1 ? "" : "s"}
        {categoryKey !== "all" ? " in this category" : ""}
        {query.trim() ? ` matching "${query.trim()}"` : ""}.
      </p>

      <div className="space-y-3">
        {filtered.length ? (
          filtered.map((r) => (
            <div
              key={r.variant_id}
              className="grid gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm md:grid-cols-[1.2fr_1fr_150px_140px]"
            >
              <div>
                <p className="font-medium">{r.product_name}</p>
                <p className="text-xs text-muted-foreground">{r.product_slug}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Category:{" "}
                  <span className="font-medium text-foreground">{r.category_name ?? "Uncategorized"}</span>
                </p>
              </div>
              <div>
                <p className="font-medium">{r.sku}</p>
                <p className="text-xs text-muted-foreground">SKU</p>
              </div>
              <div>
                <p className="font-medium">GHc {r.price_ghs.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Price</p>
              </div>
              <InventoryStockCell variantId={r.variant_id} stock={r.stock} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No variants match these filters.{query.trim() ? ` Try adjusting search or category.` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
