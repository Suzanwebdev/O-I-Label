"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminProductRow } from "@/lib/data/admin";

const PAGE_SIZE = 12;

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type StatusFilter = "all" | "active" | "draft";

function stockState(total: number): { label: string; className: string } {
  if (total <= 0) return { label: "Out of stock", className: "border-red-200 bg-red-50 text-red-700" };
  if (total <= 5) return { label: "Low stock", className: "border-amber-200 bg-amber-50 text-amber-700" };
  return { label: "In stock", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

export function AdminProductsTable({ products }: { products: AdminProductRow[] }) {
  const [query, setQuery] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState<StockFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [colorFilter, setColorFilter] = React.useState("all");
  const [sizeFilter, setSizeFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const colorOptions = React.useMemo(() => {
    return Array.from(
      new Set(products.flatMap((p) => p.variants.map((v) => v.color).filter((color): color is string => Boolean(color))))
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const sizeOptions = React.useMemo(() => {
    return Array.from(
      new Set(products.flatMap((p) => p.variants.map((v) => v.size).filter((size): size is string => Boolean(size))))
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const totalStock = product.variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.slug.toLowerCase().includes(q) ||
        product.category_name.toLowerCase().includes(q) ||
        product.variants.some((v) => v.sku.toLowerCase().includes(q));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.is_active) ||
        (statusFilter === "draft" && !product.is_active);
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "out_of_stock" && totalStock <= 0) ||
        (stockFilter === "low_stock" && totalStock > 0 && totalStock <= 5) ||
        (stockFilter === "in_stock" && totalStock > 5);
      const matchesColor =
        colorFilter === "all" ||
        product.variants.some((variant) => (variant.color ?? "").toLowerCase() === colorFilter.toLowerCase());
      const matchesSize =
        sizeFilter === "all" ||
        product.variants.some((variant) => (variant.size ?? "").toLowerCase() === sizeFilter.toLowerCase());
      return matchesQuery && matchesStatus && matchesStock && matchesColor && matchesSize;
    });
  }, [products, query, statusFilter, stockFilter, colorFilter, sizeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [query, stockFilter, statusFilter, colorFilter, sizeFilter]);

  return (
    <div className="space-y-5">
      <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Colours, sizes & photos</span> are set when you create a product: open{" "}
        <Link href="/admin/products/new" className="font-medium text-foreground underline underline-offset-2">
          New product
        </Link>
        . On this page you can search and filter by variant data once it exists.
      </p>
      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background p-4 md:grid-cols-5">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="search">Search product / slug / SKU</Label>
          <Input
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. satin-slip or BLK-M-001"
          />
        </div>
        <div className="space-y-1">
          <Label>Stock status</Label>
          <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="All stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="in_stock">In stock</SelectItem>
              <SelectItem value="low_stock">Low stock</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Colour</Label>
          <Select value={colorFilter} onValueChange={setColorFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All colors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {colorOptions.map((color) => (
                <SelectItem key={color} value={color}>
                  {color}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {colorOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No colours in catalog yet — add variants on New product.</p>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label>Size</Label>
          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All sizes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {sizeOptions.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sizeOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sizes in catalog yet — add variants on New product.</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          Showing {paged.length} of {filtered.length} products
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            setStockFilter("all");
            setStatusFilter("all");
            setColorFilter("all");
            setSizeFilter("all");
          }}
        >
          Clear filters
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Product</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Price range (GHS)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((product) => {
              const totalStock = product.variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
              const prices = product.variants.map((variant) => Number(variant.price_ghs || 0));
              const minPrice = prices.length ? Math.min(...prices) : 0;
              const maxPrice = prices.length ? Math.max(...prices) : 0;
              const state = stockState(totalStock);
              const colors = Array.from(
                new Set(product.variants.map((variant) => variant.color).filter((value): value is string => Boolean(value)))
              );
              const sizes = Array.from(
                new Set(product.variants.map((variant) => variant.size).filter((value): value is string => Boolean(value)))
              );

              return (
                <React.Fragment key={product.id}>
                <TableRow>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-expanded={expandedId === product.id}
                      aria-label={expandedId === product.id ? "Hide variant list" : "Show variant list"}
                      onClick={() => setExpandedId((id) => (id === product.id ? null : product.id))}
                    >
                      {expandedId === product.id ? "−" : "+"}
                    </Button>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.slug}</p>
                    <p className="text-xs text-muted-foreground">{product.category_name}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{product.variants.length} variants</p>
                    <p className="text-xs text-muted-foreground">Colors: {colors.join(", ") || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">Sizes: {sizes.join(", ") || "N/A"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={state.className}>
                      {state.label}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{totalStock} units total</p>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {minPrice === maxPrice ? minPrice.toFixed(2) : `${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={product.is_active ? "secondary" : "outline"}>
                        {product.is_active ? "Active" : "Draft"}
                      </Badge>
                      {product.badges.slice(0, 2).map((badge) => (
                        <Badge key={badge} variant="outline">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/product/${product.slug}`} target="_blank">
                          View
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href="/admin/inventory">Inventory</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === product.id ? (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={7} className="p-0">
                      <div className="border-t border-border p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Variant breakdown
                        </p>
                        <div className="overflow-x-auto rounded-md border border-border bg-background">
                          <table className="w-full min-w-[520px] text-sm">
                            <thead>
                              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                <th className="p-2 font-medium">Colour</th>
                                <th className="p-2 font-medium">Size</th>
                                <th className="p-2 font-medium">SKU</th>
                                <th className="p-2 font-medium text-right">Stock</th>
                                <th className="p-2 font-medium text-right">Price (GHS)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.variants.map((v) => (
                                <tr key={v.id} className="border-b border-border/70 last:border-0">
                                  <td className="p-2">{v.color ?? "—"}</td>
                                  <td className="p-2">{v.size ?? "—"}</td>
                                  <td className="p-2 font-mono text-xs">{v.sku}</td>
                                  <td className="p-2 text-right tabular-nums">{v.stock}</td>
                                  <td className="p-2 text-right tabular-nums">{Number(v.price_ghs).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                </React.Fragment>
              );
            })}
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No products match your filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
          Previous
        </Button>
        <p className="text-xs text-muted-foreground">
          Page {safePage} / {totalPages}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

