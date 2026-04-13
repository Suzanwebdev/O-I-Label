"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heading } from "@/components/store/heading";
import { TrustBar } from "@/components/store/trust-bar";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

export function HomeHeroMotion({ collage }: { collage: string[] }) {
  return (
    <motion.section
      {...fadeUp}
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border"
    >
      <div className="absolute inset-0">
        <Image
          src={`https://images.unsplash.com/photo-${collage[1]}?w=1800&h=900&fit=crop&q=80`}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/25" />
      <div className="relative grid min-h-[300px] items-end gap-6 p-6 md:min-h-[360px] md:p-10">
        <div className="max-w-xl space-y-4 text-white">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/80">
            The O & I Label edit
          </p>
          <Heading as="h1" className="max-w-[20ch] text-white">
            Minimal. Elegant. Timeless.
          </Heading>
          <p className="max-w-md text-sm text-white/80 md:text-base">
            Premium feminine essentials designed to flatter, move, and stay
            relevant beyond one season.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button asChild size="sm" className="h-10 rounded-full px-5">
              <Link href="/shop?tag=new">Shop now</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="h-10 rounded-full border-white/30 bg-white/10 px-5 text-white hover:bg-white/20"
            >
              <Link href="/shop?tag=best_seller">View best sellers</Link>
            </Button>
          </div>
        </div>
        <TrustBar compact />
      </div>
    </motion.section>
  );
}
