"use client";

import * as React from "react";
import Image from "next/image";
import type { StorefrontProduct } from "@/lib/catalog/storefront-product";
import {
  isStorefrontProductInStock,
  listingBadgesForStorefrontProduct,
  primaryStorefrontVariant,
} from "@/lib/catalog/storefront-product";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/store/price";
import { BadgeSet } from "@/components/store/badge-set";
import { PurchaseActions } from "@/components/store-control/purchase-actions";
import { SoldOutBadge, SoldOutMessage } from "@/components/store/sold-out-message";
import { RestockNotifyDialog } from "@/components/store/restock-notify-dialog";
import { shouldBypassImageOptimization } from "@/lib/media-quality";
import { shouldShowRestockNotify } from "@/lib/restock-notifications/ui";

export function QuickViewModal({
  product,
  open,
  onOpenChange,
}: {
  product: StorefrontProduct | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [restockOpen, setRestockOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setRestockOpen(false);
  }, [open, product?.id]);

  if (!product) return null;
  const v = primaryStorefrontVariant(product);
  const inStock = isStorefrontProductInStock(product);
  const showNotify = shouldShowRestockNotify(product);

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
              sizes="(max-width: 768px) 92vw, 384px"
              quality={100}
              unoptimized={shouldBypassImageOptimization(product.images[0])}
            />
            {!inStock ? (
              <div className="absolute right-3 top-3">
                <SoldOutBadge />
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-4 p-6 md:p-8">
            <DialogHeader className="space-y-2 text-left">
              <BadgeSet badges={listingBadgesForStorefrontProduct(product)} />
              <DialogTitle className="font-serif-display text-2xl leading-snug">
                {product.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <Price amountGhs={v.price_ghs} compareAtGhs={v.compare_at_ghs} />
              {!inStock ? <SoldOutMessage /> : null}
            </div>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
            <div className="mt-auto space-y-2 pt-4">
              {inStock ? (
                <PurchaseActions
                  productSlug={product.slug}
                  onAfterAdd={() => onOpenChange(false)}
                  cartPayload={{
                    variantId: v.id,
                    productId: product.id,
                    productSlug: product.slug,
                    name: product.name,
                    image: product.images[0],
                    size: v.size,
                    color: v.color,
                    quantity: 1,
                    unitPriceGhs: v.price_ghs,
                  }}
                />
              ) : (
                <>
                  <SoldOutMessage />
                  {showNotify ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="w-full rounded-[var(--radius-lg)] border-black/25 bg-white font-medium transition-colors hover:bg-muted"
                        onClick={() => setRestockOpen(true)}
                      >
                        Notify Me
                      </Button>
                      <RestockNotifyDialog
                        product={product}
                        open={restockOpen}
                        onOpenChange={setRestockOpen}
                        source="quick_view"
                      />
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
