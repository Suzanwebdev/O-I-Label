"use client";

import * as React from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { shouldBypassImageOptimization } from "@/lib/media-quality";

export function ProductGallery({
  productKey,
  productSlug,
  images,
  name,
}: {
  productKey: string;
  productSlug: string;
  images: string[];
  name: string;
}) {
  const [active, setActive] = React.useState(0);
  const [announce, setAnnounce] = React.useState("");
  const { hasItem, toggleItem } = useWishlist();
  const isSaved = hasItem(productKey);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[4.6rem_minmax(0,1fr)] md:items-start">
        <div className="order-2 flex gap-2.5 overflow-x-auto pb-1 md:order-1 md:flex-col md:overflow-visible md:pb-0">
          {images.map((src, i) => {
            const preserveQuality = shouldBypassImageOptimization(src);
            return (
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
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="64px"
                  quality={100}
                  unoptimized={preserveQuality}
                />
              </button>
            );
          })}
        </div>
        <motion.div
          className="group relative order-1 aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/60 shadow-[var(--shadow-soft)] md:order-2"
          layout
        >
          <button
            type="button"
            onClick={() => {
              const added = toggleItem({
                key: productKey,
                slug: productSlug,
                name,
                image: images[0] ?? "/file.svg",
              });
              setAnnounce(added ? "Added to wishlist" : "Removed from wishlist");
            }}
            className={cn(
              "absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition-colors",
              isSaved
                ? "border-rose-300/80 bg-rose-500/90 text-white hover:bg-rose-500"
                : "border-white/40 bg-black/25 text-white hover:bg-black/40"
            )}
            aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={isSaved}
          >
            <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
          </button>
          <span className="sr-only" aria-live="polite">
            {announce}
          </span>
          <Image
            src={images[active]}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
            sizes="(max-width: 1024px) 100vw, 55vw"
            priority
            quality={100}
            unoptimized={shouldBypassImageOptimization(images[active] ?? "")}
          />
        </motion.div>
      </div>
      <p className="text-xs text-muted-foreground">
        Roll over image to zoom. Swatches reflect available photography.
      </p>
    </div>
  );
}
