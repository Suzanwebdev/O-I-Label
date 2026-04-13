"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/providers/cart-provider";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Price } from "@/components/store/price";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus } from "lucide-react";
import * as React from "react";

export default function CartPage() {
  const { lines, updateQty, removeLine, subtotalGhs } = useCart();
  const [coupon, setCoupon] = React.useState("");

  return (
    <Container className="py-10 md:py-14">
      <Heading as="h1" eyebrow="Bag">
        Your selection
      </Heading>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {lines.length === 0 ? (
            <p className="text-muted-foreground">
              Your bag is empty.{" "}
              <Link href="/shop" className="text-navy underline">
                Continue shopping
              </Link>
            </p>
          ) : (
            lines.map((line) => (
              <div
                key={line.variantId}
                className="flex gap-4 border-b border-border pb-6"
              >
                <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted">
                  <Image
                    src={line.image}
                    alt={line.name}
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex justify-between gap-2">
                    <Link
                      href={`/product/${line.productSlug}`}
                      className="font-medium hover:text-navy"
                    >
                      {line.name}
                    </Link>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => removeLine(line.variantId)}
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[line.size, line.color].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-border">
                      <button
                        type="button"
                        className="p-2"
                        onClick={() =>
                          updateQty(line.variantId, line.quantity - 1)
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="p-2"
                        onClick={() =>
                          updateQty(line.variantId, line.quantity + 1)
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <Price
                      amountGhs={line.unitPriceGhs * line.quantity}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="h-fit space-y-6 rounded-[var(--radius-lg)] border border-border bg-muted/40 p-6">
          <div>
            <Label htmlFor="coupon">Promo code</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="coupon"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Enter code"
              />
              <Button type="button" variant="secondary">
                Apply
              </Button>
            </div>
          </div>
          <div>
            <Label>Shipping estimate</Label>
            <p className="mt-2 text-sm text-muted-foreground">
              Accra: from ₵25 · Other regions calculated at checkout.
            </p>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <Price amountGhs={subtotalGhs} />
          </div>
          <Button asChild className="w-full" size="lg" disabled={!lines.length}>
            <Link href="/checkout">Proceed to checkout</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
