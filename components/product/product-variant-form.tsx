"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { Price } from "@/components/store/price";
import { PurchaseActions } from "@/components/store-control/purchase-actions";
import { useStoreControl } from "@/components/store-control/store-control-provider";
import { Check, Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSwatchColor } from "@/lib/color-swatch";

export function ProductVariantForm({ product }: { product: Product }) {
  const router = useRouter();
  const control = useStoreControl();
  const { addItem, openCart, beginBuyNowCheckout } = useCart();
  const { hasItem, toggleItem } = useWishlist();
  const sizes = Array.from(
    new Set(product.variants.map((v) => v.size).filter(Boolean))
  ) as string[];
  const colors = Array.from(
    new Set(product.variants.map((v) => v.color).filter(Boolean))
  ) as string[];

  const [size, setSize] = React.useState(sizes[0] ?? "");
  const [color, setColor] = React.useState(colors[0] ?? "");
  const [qty, setQty] = React.useState(1);
  const [announce, setAnnounce] = React.useState("");

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
  }, [variant.id, variant.size, variant.color, sizes.length, colors.length, size, color]);

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
  const isSaved = hasItem(product.id);
  const quantityMax = Math.max(1, Math.min(variant.stock || 1, 10));
  const safeQty = Math.min(qty, quantityMax);

  React.useEffect(() => {
    if (safeQty !== qty) setQty(safeQty);
  }, [safeQty, qty]);

  function lineForVariant(nextQty: number) {
    return {
      variantId: variant.id,
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      quantity: nextQty,
      unitPriceGhs: variant.price_ghs,
      selected: true as const,
    };
  }

  function addVariantToCart(nextQty: number) {
    if (oos) return;
    addItem(lineForVariant(nextQty));
  }

  function buyNow(nextQty: number) {
    if (oos) return;
    beginBuyNowCheckout([lineForVariant(nextQty)]);
    router.push("/checkout");
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
          <div className="flex flex-wrap items-center gap-2">
            {sizes.map((s) => {
              const selected = s === size;
              const enabled = availableSizes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => enabled && setSize(s)}
                  className={cn(
                    "inline-flex min-w-11 items-center justify-center rounded-full border px-3 py-2 text-sm transition-colors",
                    selected
                      ? "border-black bg-black text-white"
                      : "border-border bg-background text-foreground hover:border-black/30",
                    !enabled && "cursor-not-allowed opacity-35"
                  )}
                  aria-label={`Select size ${s}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
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
                const swatch = resolveSwatchColor(c);
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

        {!control.checkoutAllowed ? (
          <PurchaseActions
            productSlug={product.slug}
            cartPayload={{
              variantId: variant.id,
              productId: product.id,
              productSlug: product.slug,
              name: product.name,
              image: product.images[0] ?? "/file.svg",
              size: variant.size,
              color: variant.color,
              quantity: safeQty,
              unitPriceGhs: variant.price_ghs,
            }}
          />
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-black font-semibold text-white shadow-[0_14px_32px_-20px_rgba(0,0,0,0.72)] transition-transform hover:-translate-y-[1px] hover:bg-black/90"
              disabled={oos}
              onClick={() => {
                addVariantToCart(safeQty);
                openCart();
              }}
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              Add to cart
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full rounded-[var(--radius-lg)] border-black/25 bg-white font-medium transition-colors hover:bg-muted"
              disabled={oos}
              onClick={() => buyNow(safeQty)}
            >
              Buy now
            </Button>
          </>
        )}
      </div>

      {(product.love_it_points ?? []).filter(Boolean).length > 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{"Why you'll love it"}</p>
          <ul className="mt-3 space-y-2.5 text-sm text-foreground/85">
            {(product.love_it_points ?? [])
              .map((s) => s.trim())
              .filter(Boolean)
              .map((line, idx) => (
                <li key={`${idx}-${line.slice(0, 24)}`} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total</p>
            <p className="text-sm font-medium">GH₵{(variant.price_ghs * safeQty).toFixed(2)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "rounded-[var(--radius-lg)] border-black/20 px-3 font-medium",
                isSaved && "border-rose-300 bg-rose-50 text-rose-700"
              )}
              onClick={() => {
                const added = toggleItem({
                  key: product.id,
                  slug: product.slug,
                  name: product.name,
                  image: product.images[0] ?? "/file.svg",
                });
                setAnnounce(added ? "Added to wishlist" : "Removed from wishlist");
              }}
              aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={isSaved}
            >
              <Heart className={cn("mr-1.5 h-3.5 w-3.5", isSaved && "fill-current")} />
              {isSaved ? "Saved" : "Love"}
            </Button>
            {control.checkoutAllowed ? (
              <>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 rounded-[var(--radius-lg)] bg-black px-3 font-semibold text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)] hover:bg-black/90"
              disabled={oos}
              onClick={() => {
                addVariantToCart(safeQty);
                openCart();
              }}
            >
              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
              Add to cart
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-[var(--radius-lg)] border-black/20 px-3 font-medium"
              disabled={oos}
              onClick={() => buyNow(safeQty)}
            >
              Buy now
            </Button>
              </>
            ) : control.softCloseMode ? (
              <span className="max-w-[140px] text-[10px] leading-snug text-muted-foreground">
                Purchasing paused
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{control.presaleCtaLabel}</span>
            )}
          </div>
        </div>
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
      </div>
    </div>
  );
}
