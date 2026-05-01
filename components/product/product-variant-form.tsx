"use client";

import * as React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/components/providers/cart-provider";
import { Price } from "@/components/store/price";
import { Minus, Plus, ShieldCheck, Truck, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_SWATCH: Record<string, string> = {
  black: "#171717",
  white: "#f8f8f7",
  ivory: "#efe7d8",
  cream: "#f3ead8",
  charcoal: "#4b4f54",
  gray: "#6b7280",
  grey: "#6b7280",
  navy: "#212a3f",
  nude: "#d4b59e",
  espresso: "#4a3429",
  burgundy: "#5f2337",
  olive: "#5b5f3f",
  blush: "#ddb5ad",
  brown: "#6b4f3b",
  beige: "#d9c7a8",
};

export function ProductVariantForm({ product }: { product: Product }) {
  const { addItem, openCart } = useCart();
  const sizes = Array.from(
    new Set(product.variants.map((v) => v.size).filter(Boolean))
  ) as string[];
  const colors = Array.from(
    new Set(product.variants.map((v) => v.color).filter(Boolean))
  ) as string[];

  const [size, setSize] = React.useState(sizes[0] ?? "");
  const [color, setColor] = React.useState(colors[0] ?? "");
  const [qty, setQty] = React.useState(1);

  const variant = React.useMemo(() => {
    const exact = product.variants.find(
      (v) => (sizes.length ? v.size === size : true) && (colors.length ? v.color === color : true)
    );
    if (exact) return exact;

    if (sizes.length && colors.length) {
      const bySize = product.variants.find((v) => v.size === size && v.stock > 0);
      if (bySize) return bySize;
    }
    return product.variants[0];
  }, [product.variants, size, color, sizes.length, colors.length]);

  React.useEffect(() => {
    if (sizes.length && variant.size && variant.size !== size) {
      setSize(variant.size);
    }
    if (colors.length && variant.color && variant.color !== color) {
      setColor(variant.color);
    }
  }, [variant.id]);

  const availableColors = React.useMemo(() => {
    if (!sizes.length || !size) return colors;
    return Array.from(
      new Set(
        product.variants
          .filter((v) => v.size === size)
          .map((v) => v.color)
          .filter((c): c is string => Boolean(c))
      )
    );
  }, [colors, product.variants, size, sizes.length]);

  const availableSizes = React.useMemo(() => {
    if (!colors.length || !color) return sizes;
    return Array.from(
      new Set(
        product.variants
          .filter((v) => v.color === color)
          .map((v) => v.size)
          .filter((s): s is string => Boolean(s))
      )
    );
  }, [color, colors.length, product.variants, sizes]);

  const oos = variant.stock <= 0;
  const quantityMax = Math.max(1, Math.min(variant.stock || 1, 10));
  const safeQty = Math.min(qty, quantityMax);

  React.useEffect(() => {
    if (safeQty !== qty) setQty(safeQty);
  }, [safeQty, qty]);

  function addToBag(nextQty: number) {
    if (oos) return;
    addItem({
      variantId: variant.id,
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      quantity: nextQty,
      unitPriceGhs: variant.price_ghs,
    });
  }

  return (
    <div className="space-y-5">
      {sizes.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Size</Label>
            <Link href="/contact?topic=size-guide" className="text-xs text-navy underline-offset-4 hover:underline">
              Size Guide
            </Link>
          </div>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="h-11 rounded-[var(--radius-lg)] border-border/80 bg-background">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                  {!availableSizes.includes(s) ? " (Unavailable)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {colors.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Colour</Label>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {colors.map((c) => {
                const active = c === color;
                const enabled = availableColors.includes(c);
                const swatch = COLOR_SWATCH[c.toLowerCase()] ?? "#b7b7b0";
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => enabled && setColor(c)}
                    className={cn(
                      "relative h-8 w-8 rounded-full border border-border/70 transition-transform duration-200",
                      "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60",
                      active && "ring-2 ring-black/70 ring-offset-2",
                      !enabled && "cursor-not-allowed opacity-35"
                    )}
                    aria-label={`Select colour ${c}`}
                  >
                    <span className="absolute inset-[3px] rounded-full border border-black/10" style={{ backgroundColor: swatch }} />
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">{color || "Select colour"}</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-y border-border py-3">
        <Price
          amountGhs={variant.price_ghs}
          compareAtGhs={variant.compare_at_ghs}
        />
        {oos ? <span className="text-sm text-muted-foreground">Out of stock</span> : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Quantity</Label>
          <div className="inline-flex items-center rounded-full border border-border/80 bg-background p-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
              onClick={() => setQty((n) => Math.max(1, n - 1))}
              disabled={safeQty <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-8 text-center text-sm tabular-nums">{safeQty}</span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
              onClick={() => setQty((n) => Math.min(quantityMax, n + 1))}
              disabled={safeQty >= quantityMax || oos}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full rounded-[var(--radius-lg)] bg-black text-white shadow-[0_14px_32px_-20px_rgba(0,0,0,0.72)] transition-transform hover:-translate-y-[1px] hover:bg-black/90"
          disabled={oos}
          onClick={() => {
            addToBag(safeQty);
            openCart();
          }}
        >
          Add to bag
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full rounded-[var(--radius-lg)] border-black/25 bg-white transition-colors hover:bg-black hover:text-white"
          disabled={oos}
          onClick={() => {
            addToBag(safeQty);
          openCart();
        }}
        >
          Buy it now
        </Button>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Why you'll love it</p>
        <ul className="mt-3 space-y-2.5 text-sm text-foreground/85">
          <li className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-700" />
            Free delivery on orders over GH₵500
          </li>
          <li className="flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-emerald-700" />
            Easy 14-day returns
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Secure checkout
          </li>
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex w-full max-w-[640px] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total</p>
            <p className="text-sm font-medium">GH₵{(variant.price_ghs * safeQty).toFixed(2)}</p>
          </div>
          <Button
            type="button"
            className="ml-auto rounded-[var(--radius-lg)] bg-black text-white hover:bg-black/90"
            disabled={oos}
            onClick={() => {
              addToBag(safeQty);
              openCart();
            }}
          >
            Add to bag
          </Button>
        </div>
      </div>
    </div>
  );
}
