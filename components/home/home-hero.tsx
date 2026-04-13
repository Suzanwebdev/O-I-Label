"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { HomeHeroSlide } from "@/lib/home-hero-slides";

const AUTO_MS = 1000;

export function HomeHero({
  slides,
  children,
}: {
  slides: HomeHeroSlide[];
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = React.useState(0);
  const n = slides.length;

  /** Autoplay always on (no hover-pause — the full hero is “hoverable”, which was stopping the timer on desktop). */
  React.useEffect(() => {
    if (n <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [n]);

  const duration = reduceMotion ? 0 : 0.85;

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/* 1 — slides */}
      <div className="absolute inset-0 z-0">
        {n > 0 &&
          slides.map((slide, i) => (
            <motion.div
              key={slide.src}
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: i === index ? 1 : 0 }}
              transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden={i !== index}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className="object-cover object-[center_32%] sm:object-center md:object-center"
                sizes="100vw"
                priority={i === 0}
              />
            </motion.div>
          ))}
      </div>

      {/* 2 — gradients (above images, below UI) */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/78 via-black/45 to-black/15 md:hidden"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] hidden bg-gradient-to-r from-black/70 via-black/55 to-black/35 md:block"
        aria-hidden
      />

      {/* 3 — copy + CTAs */}
      <div className="relative z-[3]">{children}</div>
    </section>
  );
}
