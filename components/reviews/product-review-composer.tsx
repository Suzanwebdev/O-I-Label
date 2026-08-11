"use client";

import * as React from "react";
import Link from "next/link";
import { ReviewForm } from "@/components/reviews/review-form";
import { Button } from "@/components/ui/button";
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
      <div className="mt-10 max-w-xl border-t border-border pt-8">
        <p className="font-serif-display text-lg font-semibold tracking-tight text-foreground">
          Have you purchased this piece?
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sign in to share your experience with O & I Label.
        </p>
        <Button asChild variant="navy" className="mt-5 tracking-[0.04em]">
          <Link href={`/login?next=${encodeURIComponent(`/product/${productSlug}`)}`}>
            Sign in to review
          </Link>
        </Button>
      </div>
    );
  }

  if (items === null) {
    return (
      <p className="mt-10 max-w-xl border-t border-border pt-8 text-sm text-muted-foreground">
        Checking your purchases…
      </p>
    );
  }

  if (error) {
    return (
      <p className="mt-10 max-w-xl border-t border-border pt-8 text-sm text-destructive">{error}</p>
    );
  }

  return (
    <div className="mt-10">
      <ReviewForm
        productId={productId}
        eligibleItems={items}
        defaultDisplayName={defaultDisplayName}
      />
    </div>
  );
}
