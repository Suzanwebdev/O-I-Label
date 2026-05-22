"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicOrderTracking } from "@/lib/data/track-order";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TrackOrderForm({
  initialOrderNumber = "",
  initialEmail = "",
}: {
  initialOrderNumber?: string;
  initialEmail?: string;
}) {
  const [orderNumber, setOrderNumber] = React.useState(initialOrderNumber);
  const [email, setEmail] = React.useState(initialEmail);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PublicOrderTracking | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const json = (await res.json()) as {
        error?: string;
        order?: PublicOrderTracking;
      };

      if (!res.ok) {
        setError(json.error ?? "Could not look up that order. Please try again.");
        return;
      }

      if (json.order) {
        setResult(json.order);
      } else {
        setError("No order details returned. Please try again.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="track-order-number">Order number</Label>
          <Input
            id="track-order-number"
            name="orderNumber"
            placeholder="e.g. OI-20260522-ABC123"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="track-order-email">Email address</Label>
          <Input
            id="track-order-email"
            name="email"
            type="email"
            placeholder="Email used at checkout"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <Button type="submit" className="sm:col-span-2" disabled={busy}>
          {busy ? "Checking…" : "Check status"}
        </Button>
      </form>

      {error ? (
        <p className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-4 rounded-[var(--radius-md)] border border-border bg-muted/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Order</p>
              <p className="font-serif-display text-xl text-foreground">{result.order_number}</p>
              <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(result.placed_at)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total</p>
              <p className="text-lg font-semibold tabular-nums">GH₵{result.total_ghs.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Order status</p>
              <p className="mt-1 font-medium text-foreground">{result.status_label}</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Payment</p>
              <p className="mt-1 font-medium text-foreground">{result.payment_label}</p>
            </div>
          </div>

          {result.tracking.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Shipping
              </p>
              <ul className="space-y-2 text-sm">
                {result.tracking.map((t, i) => (
                  <li
                    key={`${t.tracking_number ?? "ship"}-${i}`}
                    className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3"
                  >
                    {t.carrier ? <p className="font-medium">{t.carrier}</p> : null}
                    {t.tracking_number ? (
                      <p className="mt-0.5 font-mono text-[13px]">{t.tracking_number}</p>
                    ) : (
                      <p className="text-muted-foreground">Tracking number pending</p>
                    )}
                    {t.status ? (
                      <p className="mt-1 text-xs text-muted-foreground capitalize">{t.status}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.items.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Items
              </p>
              <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-background text-sm">
                {result.items.map((item, i) => (
                  <li key={`${item.sku ?? item.name}-${i}`} className="flex justify-between gap-3 px-4 py-2.5">
                    <span>
                      {item.name}
                      {item.sku ? (
                        <span className="ml-2 text-xs text-muted-foreground">({item.sku})</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-muted-foreground">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Need account-based history?{" "}
        <Link href="/login?next=/account/orders" className="text-navy underline-offset-4 hover:underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
