"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Price } from "@/components/store/price";
import { cn } from "@/lib/utils";

export function CartPageClient() {
  const {
    lines,
    selectedLines,
    updateQty,
    removeLine,
    toggleLineSelected,
    selectAllLines,
    deselectAllLines,
    subtotalGhs,
    bagSubtotalGhs,
  } = useCart();

  if (!lines.length) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center">
        <p className="text-lg font-medium">Your bag is empty.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add a few pieces you love and come back to checkout.
        </p>
        <Button asChild className="mt-4">
          <Link href="/shop">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-[var(--radius-lg)] border border-border bg-card p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="text-sm font-medium">Select items to include in checkout</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectAllLines}>
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={deselectAllLines}>
              Clear selection
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {lines.map((line) => {
            const isSelected = line.selected !== false;
            return (
              <article
                key={line.variantId}
                className={cn(
                  "flex gap-4 border-b border-border pb-4 last:border-none last:pb-0",
                  !isSelected && "opacity-60"
                )}
              >
                <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleLineSelected(line.variantId)}
                    aria-label={isSelected ? `Deselect ${line.name}` : `Select ${line.name}`}
                  />
                </div>
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted">
                  <Image src={line.image} alt={line.name} fill className="object-cover" sizes="80px" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug">{line.name}</p>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeLine(line.variantId)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{[line.size, line.color].filter(Boolean).join(" · ")}</p>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-border">
                      <button
                        type="button"
                        className="p-2 hover:bg-muted"
                        onClick={() => updateQty(line.variantId, line.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[2ch] text-center text-sm tabular-nums">{line.quantity}</span>
                      <button
                        type="button"
                        className="p-2 hover:bg-muted"
                        onClick={() => updateQty(line.variantId, line.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Price amountGhs={line.unitPriceGhs * line.quantity} className="text-sm" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {selectedLines.length < lines.length && lines.length > 1 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Unchecked items stay in your bag but are not included in the checkout total below.
          </p>
        ) : null}
      </section>

      <aside className="h-fit rounded-[var(--radius-lg)] border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal (selected)</span>
          <Price amountGhs={subtotalGhs} />
        </div>
        {selectedLines.length < lines.length ? (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Full bag value</span>
            <Price amountGhs={bagSubtotalGhs} className="text-xs text-muted-foreground" />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">Taxes and shipping are calculated at checkout.</p>
        <Button asChild className="mt-4 w-full" disabled={selectedLines.length === 0}>
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
      </aside>
    </div>
  );
}
