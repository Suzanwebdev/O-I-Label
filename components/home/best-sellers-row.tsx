"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
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
          "hidden"
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
          "hidden"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        ref={scrollerRef}
        className={cn(
          "grid grid-cols-2 gap-4 pb-1 pt-0.5 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:pb-0"
        )}
      >
        {items.map((product) => {
          const image = product.images[0];
          const v = product.variants[0]!;
          const compare = v.compare_at_ghs;

          return (
            <article
              key={product.id}
              className="w-auto min-w-0"
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
                <div className="flex flex-col gap-2 pt-0.5 sm:flex-row">
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 min-h-10 flex-1 gap-2 bg-black text-[11px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] hover:bg-black/90 sm:h-9 sm:min-h-9"
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
                    <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                    Add to cart
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-10 min-h-10 flex-1 border-black/20 text-[11px] font-medium sm:h-9 sm:min-h-9"
                  >
                    <Link href={`/product/${product.slug}`}>Buy now</Link>
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
