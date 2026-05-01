"use client";

import * as React from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = React.useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[4.6rem_minmax(0,1fr)] md:items-start">
        <div className="order-2 flex gap-2.5 overflow-x-auto pb-1 md:order-1 md:flex-col md:overflow-visible md:pb-0">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "relative h-20 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border-2 transition-all",
                i === active ? "border-navy shadow-[var(--shadow-soft)]" : "border-transparent opacity-70 hover:opacity-100"
              )}
              aria-label={`Show image ${i + 1}`}
            >
              <Image src={src} alt="" fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
        <motion.div
          className="group relative order-1 aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/60 shadow-[var(--shadow-soft)] md:order-2"
          layout
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur transition-colors hover:bg-black/40"
            aria-label="Add to wishlist"
          >
            <Heart className="h-4 w-4" />
          </button>
          <Image
            src={images[active]}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
            sizes="(max-width: 1024px) 100vw, 55vw"
            priority
          />
        </motion.div>
      </div>
      <p className="text-xs text-muted-foreground">
        Roll over image to zoom. Swatches reflect available photography.
      </p>
    </div>
  );
}
