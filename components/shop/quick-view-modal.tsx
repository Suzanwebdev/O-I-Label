"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Price } from "@/components/store/price";
import { BadgeSet } from "@/components/store/badge-set";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";

export function QuickViewModal({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { addItem, openCart } = useCart();
  if (!product) return null;
  const v = product.variants[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-[3/4] bg-muted">
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div className="flex flex-col gap-4 p-6 md:p-8">
            <DialogHeader className="space-y-2 text-left">
              <BadgeSet badges={product.badges} />
              <DialogTitle className="font-serif-display text-2xl leading-snug">
                {product.name}
              </DialogTitle>
            </DialogHeader>
            <Price amountGhs={v.price_ghs} compareAtGhs={v.compare_at_ghs} />
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <Button
                type="button"
                onClick={() => {
                  addItem({
                    variantId: v.id,
                    productId: product.id,
                    productSlug: product.slug,
                    name: product.name,
                    image: product.images[0],
                    size: v.size,
                    color: v.color,
                    quantity: 1,
                    unitPriceGhs: v.price_ghs,
                  });
                  openCart();
                  onOpenChange(false);
                }}
              >
                Add to bag
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/product/${product.slug}`}>Full details</Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
