"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { StorefrontProduct } from "@/lib/catalog/storefront-product";
import {
  isStorefrontProductInStock,
  primaryStorefrontVariant,
} from "@/lib/catalog/storefront-product";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Price } from "@/components/store/price";
import { BadgeSet } from "@/components/store/badge-set";
import { PurchaseActions } from "@/components/store-control/purchase-actions";

export function TrendingStrip({ products }: { products: StorefrontProduct[] }) {
  const list = products.length ? products : [];
  return (
    <section className="border-y border-border bg-background py-12 md:py-16">
      <Container>
        <Heading as="h2" eyebrow="In motion" className="mb-8">
          Trending now
        </Heading>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:gap-6">
          {list.map((p, i) => {
            const v = primaryStorefrontVariant(p);
            const inStock = isStorefrontProductInStock(p);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="w-[220px] shrink-0 md:w-[260px]"
              >
                <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted shadow-[var(--shadow-soft)]">
                  <Link href={`/product/${p.slug}`} className="relative block aspect-[3/4]">
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      className="object-cover transition duration-500 hover:scale-[1.03]"
                      sizes="260px"
                    />
                    <div className="absolute left-2 top-2">
                      <BadgeSet badges={p.badges.slice(0, 2)} />
                    </div>
                  </Link>
                  <div className="space-y-2 p-4">
                    <Link href={`/product/${p.slug}`} className="block">
                      <p className="font-serif-display text-base leading-snug hover:text-navy">{p.name}</p>
                    </Link>
                    {p.description?.trim() ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.description.trim()}</p>
                    ) : null}
                    <Price amountGhs={v.price_ghs} compareAtGhs={v.compare_at_ghs} />
                    {inStock ? (
                      <PurchaseActions
                        productSlug={p.slug}
                        layout="row"
                        cartPayload={{
                          variantId: v.id,
                          productId: p.id,
                          productSlug: p.slug,
                          name: p.name,
                          image: p.images[0],
                          size: v.size,
                          color: v.color,
                          quantity: 1,
                          unitPriceGhs: v.price_ghs,
                        }}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">Out of stock</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
