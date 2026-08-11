"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ReviewPhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: Array<{ id: string; public_url: string }>;
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const current = photos[index];

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange(Math.min(photos.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer photo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full border border-white/30 px-3 py-1 text-sm text-white"
        onClick={onClose}
      >
        Close
      </button>
      {photos.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 px-3 py-2 text-white disabled:opacity-40"
            disabled={index <= 0}
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(index - 1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 px-3 py-2 text-white disabled:opacity-40"
            disabled={index >= photos.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(index + 1);
            }}
          >
            ›
          </button>
        </>
      ) : null}
      <div
        className="relative h-[min(80vh,720px)] w-full max-w-lg overflow-hidden rounded-lg bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={current.public_url}
          alt="Customer review photo"
          fill
          className="object-contain"
          sizes="512px"
          unoptimized
        />
      </div>
      <p className={cn("absolute bottom-4 text-xs text-white/80")}>
        {index + 1} / {photos.length}
      </p>
    </div>
  );
}

export function ReviewPhotoGallery({
  photos,
  className,
}: {
  photos: Array<{ id: string; public_url: string }>;
  className?: string;
}) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  if (!photos.length) return null;

  return (
    <>
      <div className={className}>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Customer photos
        </p>
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                onClick={() => setOpenIndex(i)}
                aria-label="Open customer photo"
              >
                <Image
                  src={p.public_url}
                  alt="Customer review photo"
                  fill
                  className="object-cover"
                  sizes="80px"
                  unoptimized
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {openIndex != null ? (
        <ReviewPhotoLightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
        />
      ) : null}
    </>
  );
}
