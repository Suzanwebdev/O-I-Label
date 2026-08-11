"use client";

import * as React from "react";
import { StarRating } from "@/components/reviews/star-rating";
import { ReviewCard } from "@/components/reviews/review-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReviewAggregates, ReviewPublic } from "@/lib/reviews/types";

type FilterKey = "all" | "5" | "4" | "3" | "2" | "1" | "photos";
type SortKey = "newest" | "highest" | "lowest";

export function ProductReviewsSection({
  productId,
  initialAggregates,
  initialReviews,
  initialTotal,
}: {
  productId: string;
  initialAggregates: ReviewAggregates;
  initialReviews: ReviewPublic[];
  initialTotal: number;
}) {
  const [aggregates, setAggregates] = React.useState(initialAggregates);
  const [reviews, setReviews] = React.useState(initialReviews);
  const [total, setTotal] = React.useState(initialTotal);
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  async function load(next: { filter?: FilterKey; sort?: SortKey; page?: number }) {
    const f = next.filter ?? filter;
    const s = next.sort ?? sort;
    const p = next.page ?? page;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        productId,
        page: String(p),
        pageSize: "8",
        sort: s,
      });
      if (f === "photos") params.set("withPhotos", "1");
      else if (f !== "all") params.set("rating", f);

      const res = await fetch(`/api/reviews?${params.toString()}`);
      const json = (await res.json()) as {
        reviews?: ReviewPublic[];
        total?: number;
        aggregates?: ReviewAggregates;
      };
      if (!res.ok) return;
      setReviews(json.reviews ?? []);
      setTotal(json.total ?? 0);
      if (json.aggregates) setAggregates(json.aggregates);
    } finally {
      setLoading(false);
    }
  }

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "5", label: "5★" },
    { key: "4", label: "4★" },
    { key: "3", label: "3★" },
    { key: "2", label: "2★" },
    { key: "1", label: "1★" },
    { key: "photos", label: "With Photos" },
  ];

  const maxBar = Math.max(1, ...Object.values(aggregates.distribution));

  return (
    <section className="mt-14 border-t border-border pt-10 md:mt-16 md:pt-12" aria-labelledby="customer-reviews-heading">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Customer reviews
      </p>
      <h2 id="customer-reviews-heading" className="mt-2 font-serif-display text-2xl font-semibold tracking-tight">
        What clients say
      </h2>

      {aggregates.count === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No reviews yet. Be the first to share your experience.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-6">
            <div>
              <div className="flex items-center gap-2">
                <StarRating value={aggregates.average ?? 0} size="lg" />
                <span className="font-serif-display text-3xl font-semibold">
                  {aggregates.average?.toFixed(1)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on {aggregates.count} review{aggregates.count === 1 ? "" : "s"}
              </p>
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = aggregates.distribution[star];
                const pct = Math.round((count / maxBar) * 100);
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-10">{star} stars</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-foreground/80" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setFilter(f.key);
                    setPage(1);
                    void load({ filter: f.key, page: 1 });
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    filter === f.key
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Sort
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
                value={sort}
                onChange={(e) => {
                  const next = e.target.value as SortKey;
                  setSort(next);
                  setPage(1);
                  void load({ sort: next, page: 1 });
                }}
              >
                <option value="newest">Most recent</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </select>
            </label>
          </div>

          <div className={cn("mt-2", loading && "opacity-60")}>
            {reviews.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">No reviews match this filter.</p>
            ) : (
              reviews.map((r) => <ReviewCard key={r.id} review={r} />)
            )}
          </div>

          {total > reviews.length || page > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || page <= 1}
                onClick={() => {
                  const next = page - 1;
                  setPage(next);
                  void load({ page: next });
                }}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || page * 8 >= total}
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  void load({ page: next });
                }}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
