"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/store/price";

export function CartPageClient() {
  const { lines, updateQty, removeLine, subtotalGhs } = useCart();

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
      <section className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-card p-4 md:p-6">
        {lines.map((line) => (
          <article key={line.variantId} className="flex gap-4 border-b border-border pb-4 last:border-none last:pb-0">
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
        ))}
      </section>

      <aside className="h-fit rounded-[var(--radius-lg)] border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <Price amountGhs={subtotalGhs} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Taxes and shipping are calculated at checkout.</p>
        <Button asChild className="mt-4 w-full">
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
      </aside>
    </div>
  );
}
