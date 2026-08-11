"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPurchasedVariantLine } from "@/lib/reviews/types";
import type { AdminReviewRow } from "@/lib/reviews/admin";
import type { ReviewStatus } from "@/lib/reviews/types";

const TABS: Array<{ key: ReviewStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
  { key: "hidden", label: "Hidden" },
];

export function AdminReviewsPanel() {
  const [status, setStatus] = React.useState<ReviewStatus | "all">("pending");
  const [rows, setRows] = React.useState<AdminReviewRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load(nextStatus = status) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews?status=${encodeURIComponent(nextStatus)}`);
      const json = (await res.json()) as {
        rows?: AdminReviewRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not load reviews.");
        return;
      }
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setError("Could not load reviews.");
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function act(reviewId: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, ...patch }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Action failed.");
        return;
      }
      await load(status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer reviews</CardTitle>
        <CardDescription>
          New reviews stay pending until you publish them. Featured reviews can appear on the homepage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatus(t.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                status === t.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {total} review{total === 1 ? "" : "s"}
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-4">
          {rows.length === 0 && !busy ? (
            <p className="text-sm text-muted-foreground">No reviews in this filter.</p>
          ) : null}
          {rows.map((row) => {
            const variant = formatPurchasedVariantLine(row.purchased_color, row.purchased_size);
            return (
              <article key={row.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {"★".repeat(row.rating)}
                      <span className="text-muted-foreground">{"☆".repeat(5 - row.rating)}</span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                        {row.status}
                        {row.featured ? " · featured" : ""}
                      </span>
                    </p>
                    <p className="font-medium text-foreground">{row.product_name ?? "Product"}</p>
                    {row.title ? <p className="font-medium">{row.title}</p> : null}
                    {row.body ? (
                      <p className="whitespace-pre-wrap text-muted-foreground">{row.body}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {row.display_name ?? "Customer"}
                      {row.verified_purchase ? " · ✓ Verified Purchase" : ""}
                      {variant ? ` · ${variant}` : ""}
                      {row.order_number ? ` · ${row.order_number}` : ""}
                      {row.photo_count
                        ? ` · ${row.photo_count} photo${row.photo_count === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.status !== "published" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void act(row.id, { status: "published" })}
                      >
                        Publish
                      </Button>
                    ) : null}
                    {row.status !== "rejected" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void act(row.id, { status: "rejected" })}
                      >
                        Reject
                      </Button>
                    ) : null}
                    {row.status !== "hidden" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void act(row.id, { status: "hidden" })}
                      >
                        Hide
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void act(row.id, { status: "pending" })}
                      >
                        Restore
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act(row.id, { featured: !row.featured })}
                    >
                      {row.featured ? "Unfeature" : "Feature"}
                    </Button>
                    {row.order_id ? (
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link href={`/admin/orders`}>Order</Link>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Delete this review permanently?")) {
                          void act(row.id, { delete: true });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
