"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { RestockDemandPanel } from "@/components/admin/restock-demand-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterRestockDemandOverview } from "@/lib/restock-notifications/demand-analytics";
import type { RestockDemandOverviewProduct } from "@/lib/restock-notifications/demand-analytics";

type Props = {
  products: RestockDemandOverviewProduct[];
};

function formatTop(
  label: string | undefined,
  count: number | undefined
): string {
  if (!label || count == null) return "—";
  return `${label} — ${count}`;
}

export function RestockDemandOverview({ products }: Props) {
  const [query, setQuery] = React.useState("");
  const [categoryKey, setCategoryKey] = React.useState("all");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const categoryOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (!map.has(p.categoryName)) map.set(p.categoryName, p.categoryName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const filtered = React.useMemo(
    () => filterRestockDemandOverview(products, query, categoryKey),
    [products, query, categoryKey]
  );

  if (!products.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No customers are currently waiting for a restock.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background p-4 md:grid-cols-[1.5fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="restock-demand-search">Search products</Label>
          <Input
            id="restock-demand-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. silk midi, dresses…"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={categoryKey} onValueChange={setCategoryKey}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} product{filtered.length === 1 ? "" : "s"} with active demand
        {query.trim() ? ` matching “${query.trim()}”` : ""}
        {categoryKey !== "all" ? ` in ${categoryKey}` : ""}. Sorted by waiting customers.
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products match these filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => {
            const expanded = expandedId === product.productId;
            const comboLabel = product.topCombination
              ? `${product.topCombination.colorLabel} / ${product.topCombination.sizeLabel}`
              : undefined;
            return (
              <div
                key={product.productId}
                className="rounded-[var(--radius-lg)] border border-border bg-background"
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() =>
                    setExpandedId(expanded ? null : product.productId)
                  }
                  aria-expanded={expanded}
                >
                  <div className="relative mt-0.5 h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    <Image
                      src={product.imagePath || "/file.svg"}
                      alt={product.productName}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-foreground">{product.productName}</p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {product.waiting} waiting
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {product.categoryName}
                      {product.productSlug ? ` · ${product.productSlug}` : ""}
                    </p>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                      <p>
                        <span className="font-medium text-foreground">Top size:</span>{" "}
                        {formatTop(product.topSize?.label, product.topSize?.count)}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Top colour:</span>{" "}
                        {formatTop(product.topColor?.label, product.topColor?.count)}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Top request:</span>{" "}
                        {formatTop(comboLabel, product.topCombination?.count)}
                      </p>
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <div className="space-y-3 border-t border-border px-4 py-4">
                    <RestockDemandPanel demand={product.demand} />
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/products/${product.productId}`}>Edit product</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/inventory?product=${product.productId}`}>
                          Open inventory
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
