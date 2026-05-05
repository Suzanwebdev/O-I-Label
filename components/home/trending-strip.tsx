"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Product } from "@/lib/types";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Price } from "@/components/store/price";
import { BadgeSet } from "@/components/store/badge-set";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";
import { ShoppingBag } from "lucide-react";

export function TrendingStrip({ products }: { products: Product[] }) {
  const { addItem, openCart } = useCart();
  const list = products.length ? products : [];
  return (
    <section className="border-y border-border bg-background py-12 md:py-16">
      <Container>
        <Heading as="h2" eyebrow="In motion" className="mb-8">
          Trending now
        </Heading>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:gap-6">
          {list.map((p, i) => {
            const v = p.variants[0];
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
                    <div className="flex flex-col gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full gap-2 bg-black text-[11px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] hover:bg-black/90"
                        onClick={() => {
                          addItem({
                            variantId: v.id,
                            productId: p.id,
                            productSlug: p.slug,
                            name: p.name,
                            image: p.images[0],
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
                      <Button asChild variant="outline" size="sm" className="h-9 w-full border-black/20 text-[11px] font-medium">
                        <Link href={`/product/${p.slug}`}>Buy now</Link>
                      </Button>
                    </div>
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
