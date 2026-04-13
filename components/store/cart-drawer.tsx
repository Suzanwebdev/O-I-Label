"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Price } from "@/components/store/price";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CartDrawer() {
  const {
    lines,
    isOpen,
    closeCart,
    updateQty,
    removeLine,
    subtotalGhs,
  } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && closeCart()}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 font-serif-display text-xl">
            <ShoppingBag className="h-5 w-5" />
            Your bag
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your bag is empty. Discover new arrivals curated for elevated
              everyday confidence.
            </p>
          ) : (
            <ul className="space-y-6">
              <AnimatePresence initial={false}>
                {lines.map((line) => (
                  <motion.li
                    key={line.variantId}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className="flex gap-4"
                  >
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted">
                      <Image
                        src={line.image}
                        alt={line.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex justify-between gap-2">
                        <p className="font-medium leading-snug">{line.name}</p>
                        <button
                          type="button"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => removeLine(line.variantId)}
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[line.size, line.color].filter(Boolean).join(" · ")}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-border">
                          <button
                            type="button"
                            className="p-2 hover:bg-muted"
                            onClick={() =>
                              updateQty(line.variantId, line.quantity - 1)
                            }
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[2ch] text-center text-sm tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="p-2 hover:bg-muted"
                            onClick={() =>
                              updateQty(line.variantId, line.quantity + 1)
                            }
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Price
                          amountGhs={line.unitPriceGhs * line.quantity}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border bg-background px-6 py-4">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <Price amountGhs={subtotalGhs} />
          </div>
          <Separator className="mb-4" />
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full" disabled={lines.length === 0}>
              <Link href="/checkout" onClick={closeCart}>
                Checkout
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/cart" onClick={closeCart}>
                View full bag
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Taxes and shipping calculated at checkout.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
