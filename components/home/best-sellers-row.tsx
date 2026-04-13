"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/store/price";
import { useCart } from "@/components/providers/cart-provider";
import { cn } from "@/lib/utils";

export function BestSellersRow({ products }: { products: Product[] }) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ left: true, right: false });
  const { addItem, openCart } = useCart();

  const items = React.useMemo(
    () => products.filter((p) => p.variants[0]),
    [products]
  );

  const updateEdges = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setEdges({
      left: scrollLeft <= 2,
      right: scrollLeft >= max - 2 || max <= 0,
    });
  }, []);

  React.useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, [items.length, updateEdges]);

  const scrollByDir = React.useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.max(280, el.clientWidth * 0.72),
      behavior: "smooth",
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="See previous products"
        onClick={() => scrollByDir(-1)}
        disabled={edges.left}
        className={cn(
          "absolute left-0 top-[42%] z-10 flex h-11 min-h-[44px] w-11 min-w-[44px] -translate-x-0.5 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-[var(--shadow-soft)] backdrop-blur-sm transition active:scale-95 hover:border-navy/30 disabled:pointer-events-none disabled:opacity-25 md:h-11 md:w-11 md:-translate-x-2"
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="See more products"
        onClick={() => scrollByDir(1)}
        disabled={edges.right}
        className={cn(
          "absolute right-0 top-[42%] z-10 flex h-11 min-h-[44px] w-11 min-w-[44px] translate-x-0.5 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-[var(--shadow-soft)] backdrop-blur-sm transition active:scale-95 hover:border-navy/30 disabled:pointer-events-none disabled:opacity-25 md:h-11 md:w-11 md:translate-x-2"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        ref={scrollerRef}
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-3 pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] md:gap-5 md:scroll-px-4",
          "[&::-webkit-scrollbar]:hidden"
        )}
      >
        {items.map((product) => {
          const image = product.images[0];
          const v = product.variants[0]!;
          const compare = v.compare_at_ghs;

          return (
            <article
              key={product.id}
              className="w-[min(74vw,268px)] shrink-0 snap-start sm:w-[240px] md:w-[252px]"
            >
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
                    sizes="(max-width: 640px) 74vw, 252px"
                  />
                </div>
              </Link>
              <div className="mt-3 flex flex-col gap-2">
                <Link href={`/product/${product.slug}`}>
                  <h3 className="line-clamp-2 font-serif-display text-[15px] leading-snug text-foreground transition-colors hover:text-navy md:text-base">
                    {product.name}
                  </h3>
                </Link>
                <Price
                  amountGhs={v.price_ghs}
                  compareAtGhs={compare}
                  className="[&_span:first-child]:text-[15px] [&_span:first-child]:font-semibold"
                />
                <div className="flex flex-col gap-2 pt-0.5 sm:flex-row">
                  <Button
                    asChild
                    size="sm"
                    className="h-10 min-h-10 flex-1 text-[11px] font-medium sm:h-9 sm:min-h-9"
                  >
                    <Link href={`/product/${product.slug}`}>Buy now</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 min-h-10 flex-1 text-[11px] font-medium sm:h-9 sm:min-h-9"
                    onClick={() => {
                      addItem({
                        variantId: v.id,
                        productId: product.id,
                        productSlug: product.slug,
                        name: product.name,
                        image,
                        size: v.size,
                        color: v.color,
                        quantity: 1,
                        unitPriceGhs: v.price_ghs,
                      });
                      openCart();
                    }}
                  >
                    Add to cart
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
