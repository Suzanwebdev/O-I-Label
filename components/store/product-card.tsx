"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { StorefrontProduct } from "@/lib/catalog/storefront-product";
import {
  isStorefrontProductInStock,
  primaryStorefrontVariant,
} from "@/lib/catalog/storefront-product";
import { BadgeSet } from "@/components/store/badge-set";
import { Price } from "@/components/store/price";
import { PurchaseActions } from "@/components/store-control/purchase-actions";
import { SoldOutBadge, SoldOutMessage } from "@/components/store/sold-out-message";
import { cn } from "@/lib/utils";
import { shouldBypassImageOptimization } from "@/lib/media-quality";

export function ProductCard({
  product,
  className,
  priority,
}: {
  product: StorefrontProduct;
  className?: string;
  priority?: boolean;
}) {
  const image = product.images[0];
  const preserveQuality = shouldBypassImageOptimization(image);
  const v = primaryStorefrontVariant(product);
  const compare = v.compare_at_ghs;
  const inStock = isStorefrontProductInStock(product);

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
            quality={100}
            unoptimized={preserveQuality}
          />
          <div className="absolute left-3 top-3">
            <BadgeSet badges={product.badges} />
          </div>
          {!inStock ? (
            <div className="absolute right-3 top-3">
              <SoldOutBadge />
            </div>
          ) : null}
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
        {inStock ? (
          <PurchaseActions
            productSlug={product.slug}
            className="mt-auto pt-1"
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
        ) : (
          <SoldOutMessage className="mt-auto pt-1" />
        )}
      </div>
    </motion.article>
  );
}
