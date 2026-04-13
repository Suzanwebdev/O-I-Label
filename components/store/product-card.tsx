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
        <Price amountGhs={v.price_ghs} compareAtGhs={compare} />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-auto w-full gap-2"
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
          <ShoppingBag className="h-4 w-4" />
          Quick add
        </Button>
      </div>
    </motion.article>
  );
}
