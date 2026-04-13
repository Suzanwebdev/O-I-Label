"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/lib/types";
import { filterProducts, sortProducts } from "@/lib/shop-utils";
import { ProductCard } from "@/components/store/product-card";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";
import { QuickViewModal } from "@/components/shop/quick-view-modal";

const sizes = ["XS", "S", "M", "L", "XL"];
const colors = ["Black", "Ivory", "Navy", "Nude", "Espresso"];

export function ShopCatalog({
  products,
  categorySlug,
  title,
}: {
  products: Product[];
  categorySlug?: string;
  title?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [quickView, setQuickView] = React.useState<Product | null>(null);

  const q = sp.get("q") ?? "";
  const tag = sp.get("tag") ?? "";
  const sort = sp.get("sort") ?? "best_sellers";
  const minP = sp.get("min") ? Number(sp.get("min")) : undefined;
  const maxP = sp.get("max") ? Number(sp.get("max")) : undefined;

  const sizeFilters = sp.getAll("size");
  const colorFilters = sp.getAll("color");

  const filtered = React.useMemo(() => {
    let list = filterProducts(products, {
      q,
      category: categorySlug,
      tag: tag || undefined,
      minPrice: minP,
      maxPrice: maxP,
      sizes: sizeFilters.length ? sizeFilters : undefined,
      colors: colorFilters.length ? colorFilters : undefined,
      inStockOnly: sp.get("stock") === "1",
    });
    list = sortProducts(list, sort);
    return list;
  }, [
    products,
    q,
    categorySlug,
    tag,
    minP,
    maxP,
    sort,
    sp,
    sizeFilters,
    colorFilters,
  ]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">Price (GHS)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            className="h-10"
            defaultValue={minP ?? ""}
            onBlur={(e) =>
              setParam("min", e.target.value || null)
            }
          />
          <Input
            type="number"
            placeholder="Max"
            className="h-10"
            defaultValue={maxP ?? ""}
            onBlur={(e) =>
              setParam("max", e.target.value || null)
            }
          />
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Size</Label>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sp.getAll("size").includes(s)}
                onCheckedChange={(c) => {
                  const next = new URLSearchParams(sp.toString());
                  const cur = new Set(next.getAll("size"));
                  if (c) cur.add(s);
                  else cur.delete(s);
                  next.delete("size");
                  cur.forEach((x) => next.append("size", x));
                  router.push(`?${next.toString()}`, { scroll: false });
                }}
              />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Colour</Label>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sp.getAll("color").includes(c)}
                onCheckedChange={(chk) => {
                  const next = new URLSearchParams(sp.toString());
                  const cur = new Set(next.getAll("color"));
                  if (chk) cur.add(c);
                  else cur.delete(c);
                  next.delete("color");
                  cur.forEach((x) => next.append("color", x));
                  router.push(`?${next.toString()}`, { scroll: false });
                }}
              />
              {c}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={sp.get("stock") === "1"}
          onCheckedChange={(c) => setParam("stock", c ? "1" : null)}
        />
        In stock only
      </label>
    </div>
  );

  return (
    <Container className="py-10 md:py-14">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <Heading as="h1" eyebrow="Shop">
          {title ?? "All pieces"}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="relative min-w-[200px] flex-1 md:max-w-xs"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setParam("q", (fd.get("q") as string) || null);
            }}
          >
            <Input
              name="q"
              placeholder="Search..."
              defaultValue={q}
              className="h-10 pr-3"
            />
          </form>
          <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
            <SelectTrigger className="h-10 w-[200px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best_sellers">Best sellers</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
              <SelectItem value="price_desc">Price: high to low</SelectItem>
              <SelectItem value="rated">Top rated</SelectItem>
            </SelectContent>
          </Select>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 lg:hidden">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">{filterPanel}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-10 lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Refine
          </p>
          {filterPanel}
        </aside>
        <div>
          <p className="mb-6 text-sm text-muted-foreground">
            {filtered.length} piece{filtered.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <div key={p.id} className="space-y-2">
                <ProductCard product={p} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-navy"
                  onClick={() => setQuickView(p)}
                >
                  Quick view
                </Button>
              </div>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="py-20 text-center text-muted-foreground">
              No pieces match your filters. Reset selections or explore{" "}
              <button
                type="button"
                className="text-navy underline"
                onClick={() => router.push("/shop")}
              >
                the full collection
              </button>
              .
            </p>
          ) : null}
        </div>
      </div>

      <QuickViewModal
        product={quickView}
        open={!!quickView}
        onOpenChange={(o) => !o && setQuickView(null)}
      />
    </Container>
  );
}
