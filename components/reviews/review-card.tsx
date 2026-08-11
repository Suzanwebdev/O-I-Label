"use client";

import Image from "next/image";
import { StarRating } from "@/components/reviews/star-rating";
import { formatPurchasedVariantLine } from "@/lib/reviews/types";
import type { ReviewPublic } from "@/lib/reviews/types";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ReviewCard({ review }: { review: ReviewPublic }) {
  const variant = formatPurchasedVariantLine(review.purchased_color, review.purchased_size);
  return (
    <article className="border-b border-border py-6 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StarRating value={review.rating} />
        <time className="text-xs text-muted-foreground" dateTime={review.published_at ?? review.created_at}>
          {formatDate(review.published_at ?? review.created_at)}
        </time>
      </div>
      {review.title ? (
        <h3 className="mt-2 text-sm font-semibold tracking-tight text-foreground">{review.title}</h3>
      ) : null}
      {review.body ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{review.body}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/80">
        <span className="font-medium">{review.display_name}</span>
        {review.verified_purchase ? (
          <span className="text-emerald-800">✓ Verified Purchase</span>
        ) : null}
      </div>
      {variant ? (
        <p className="mt-1 text-xs text-muted-foreground">Purchased: {variant}</p>
      ) : null}
      {review.media.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {review.media.map((m) => (
            <li key={m.id} className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-muted">
              <Image
                src={m.public_url}
                alt="Customer review photo"
                fill
                className="object-cover"
                sizes="80px"
                unoptimized
              />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
