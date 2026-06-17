"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/store/price";
import { PurchaseActions } from "@/components/store-control/purchase-actions";
import { HOME_BEST_SELLERS_BATCH } from "@/lib/shop-utils";

export function BestSellersRow({ products }: { products: Product[] }) {
  const [visibleCount, setVisibleCount] = React.useState(HOME_BEST_SELLERS_BATCH);

  const items = React.useMemo(
    () => products.filter((p) => p.variants[0]),
    [products]
  );

  React.useEffect(() => {
    setVisibleCount(HOME_BEST_SELLERS_BATCH);
  }, [products]);

  if (items.length === 0) return null;

  const visibleItems = items.slice(0, visibleCount);
  const remaining = items.length - visibleCount;
  const hasMore = remaining > 0;
  const nextBatch = Math.min(HOME_BEST_SELLERS_BATCH, remaining);

  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-4 pb-1 pt-0.5 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:pb-0">
        {visibleItems.map((product) => {
          const image = product.images[0];
          const v = product.variants[0]!;
          const compare = v.compare_at_ghs;

          return (
            <article key={product.id} className="w-auto min-w-0">
              <Link
                href={`/product/${product.slug}`}
                className="group relative block overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted/40"
              >
                <div className="relative aspect-[3/4]">
                  <Image
                    src={image}
                    alt={product.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
              </Link>
              <div className="mt-3 flex flex-col gap-2">
                <Link href={`/product/${product.slug}`}>
                  <h3 className="line-clamp-2 font-serif-display text-[15px] leading-snug text-foreground transition-colors hover:text-navy md:text-base">
                    {product.name}
                  </h3>
                </Link>
                {product.description?.trim() ? (
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground md:text-xs">
                    {product.description.trim()}
                  </p>
                ) : null}
                <Price
                  amountGhs={v.price_ghs}
                  compareAtGhs={compare}
                  className="[&_span:first-child]:text-[15px] [&_span:first-child]:font-semibold"
                />
                <PurchaseActions
                  productSlug={product.slug}
                  layout="row"
                  cartPayload={{
                    variantId: v.id,
                    productId: product.id,
                    productSlug: product.slug,
                    name: product.name,
                    image,
                    size: v.size,
                    color: v.color,
                    quantity: 1,
                    unitPriceGhs: v.price_ghs,
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>
      {hasMore ? (
        <div className="mt-8 flex justify-center md:mt-10">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 rounded-full border-black/20 px-8 text-[13px] font-medium sm:h-10 sm:min-h-10"
            onClick={() =>
              setVisibleCount((n) => Math.min(n + HOME_BEST_SELLERS_BATCH, items.length))
            }
          >
            Show {nextBatch} more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
