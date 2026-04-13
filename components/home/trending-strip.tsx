"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Product } from "@/lib/types";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Price } from "@/components/store/price";
import { BadgeSet } from "@/components/store/badge-set";

export function TrendingStrip({ products }: { products: Product[] }) {
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
                <Link
                  href={`/product/${p.slug}`}
                  className="block overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted shadow-[var(--shadow-soft)]"
                >
                  <div className="relative aspect-[3/4]">
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
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="font-serif-display text-base leading-snug">
                      {p.name}
                    </p>
                    <Price amountGhs={v.price_ghs} compareAtGhs={v.compare_at_ghs} />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
