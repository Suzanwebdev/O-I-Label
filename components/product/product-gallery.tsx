"use client";

import * as React from "react";
import Image from "next/image";
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
  const [zoom, setZoom] = React.useState(false);

  return (
    <div className="space-y-4">
      <motion.div
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted cursor-zoom-in",
          zoom && "cursor-zoom-out"
        )}
        onClick={() => setZoom((z) => !z)}
        layout
      >
        <Image
          src={images[active]}
          alt={name}
          fill
          className={cn(
            "object-cover transition-transform duration-500",
            zoom && "scale-150"
          )}
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </motion.div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "relative h-20 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border-2 transition-colors",
              i === active ? "border-navy" : "border-transparent opacity-70 hover:opacity-100"
            )}
          >
            <Image src={src} alt="" fill className="object-cover" sizes="64px" />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Tap the main image to zoom. Swatches reflect available photography.
      </p>
    </div>
  );
}
