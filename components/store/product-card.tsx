"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Product } from "@/lib/types";
import { BadgeSet } from "@/components/store/badge-set";
import { Price } from "@/components/store/price";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/providers/cart-provider";
import { ShoppingBag } from "lucide-react";

export function ProductCard({
  product,
  className,
  priority,
}: {
  product: Product;
  className?: string;
  priority?: boolean;
}) {
  const { addItem, openCart } = useCart();
  const image = product.images[0];
  const v = product.variants[0];
  const compare = v.compare_at_ghs;

  return (
    <motion.article
      layout
      className={cn("group flex flex-col", className)}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative block overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted shadow-[var(--shadow-soft)]"
      >
        <div className="relative aspect-[3/4]">
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 50vw, 25vw"
            priority={priority}
          />
          <div className="absolute left-3 top-3">
            <BadgeSet badges={product.badges} />
          </div>
        </div>
      </Link>
      <div className="mt-4 flex flex-1 flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {product.category_name}
        </p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-serif-display text-lg leading-snug text-foreground transition-colors group-hover:text-navy">
            {product.name}
          </h3>
        </Link>
        {product.description?.trim() ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{product.description.trim()}</p>
        ) : null}
        <Price amountGhs={v.price_ghs} compareAtGhs={compare} />
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="w-full gap-2 bg-black text-[11px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] hover:bg-black/90 sm:text-sm"
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
            <ShoppingBag className="h-4 w-4 shrink-0" />
            Add to cart
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full border-black/20 text-[11px] font-medium sm:text-sm"
          >
            <Link href={`/product/${product.slug}`}>Buy now</Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
