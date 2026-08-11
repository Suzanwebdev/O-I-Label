"use client";

import * as React from "react";
import Link from "next/link";
import { ReviewForm } from "@/components/reviews/review-form";
import type { EligibleReviewItem } from "@/lib/reviews/types";

export function ProductReviewComposer({
  productId,
  productSlug,
  isSignedIn,
  defaultDisplayName,
}: {
  productId: string;
  productSlug: string;
  isSignedIn: boolean;
  defaultDisplayName: string;
}) {
  const [items, setItems] = React.useState<EligibleReviewItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reviews/eligible?productId=${encodeURIComponent(productId)}`);
        const json = (await res.json()) as { items?: EligibleReviewItem[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Could not load review eligibility.");
          setItems([]);
          return;
        }
        setItems(json.items ?? []);
      } catch {
        if (!cancelled) {
          setError("Could not load review eligibility.");
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, productId]);

  if (!isSignedIn) {
    return (
      <div className="mt-8 rounded-[var(--radius-lg)] border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <Link
          href={`/login?next=${encodeURIComponent(`/product/${productSlug}`)}`}
          className="text-navy underline underline-offset-2"
        >
          Sign in
        </Link>{" "}
        to leave a verified review for a piece you’ve purchased.
      </div>
    );
  }

  if (items === null) {
    return <p className="mt-8 text-sm text-muted-foreground">Checking your purchases…</p>;
  }

  if (error) {
    return <p className="mt-8 text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="mt-8">
      <ReviewForm
        productId={productId}
        eligibleItems={items}
        defaultDisplayName={defaultDisplayName}
      />
    </div>
  );
}
