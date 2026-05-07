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
import { ShoppingBag } from "lucide-react";
import { shouldBypassImageOptimization } from "@/lib/media-quality";

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
  const preserveQuality = shouldBypassImageOptimization(product.images[0] ?? "");

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
              quality={100}
              unoptimized={preserveQuality}
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
                className="w-full gap-2 bg-black font-semibold text-white shadow-[0_10px_28px_-14px_rgba(0,0,0,0.6)] hover:bg-black/90"
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
                <ShoppingBag className="h-4 w-4 shrink-0" />
                Add to cart
              </Button>
              <Button asChild variant="outline" className="w-full border-black/20 font-medium">
                <Link href={`/product/${product.slug}`} onClick={() => onOpenChange(false)}>
                  Buy now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
