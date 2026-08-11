"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ReviewsVisibilityToggle({
  initialEnabled,
  appearance = "light",
}: {
  initialEnabled: boolean;
  appearance?: "light" | "dark";
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onToggle(next: boolean) {
    setBusy(true);
    setError(null);
    const prev = enabled;
    setEnabled(next);
    try {
      const res = await fetch("/api/admin/reviews/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const json = (await res.json()) as { enabled?: boolean; error?: string };
      if (!res.ok) {
        setEnabled(prev);
        setError(json.error ?? "Could not update visibility.");
        return;
      }
      setEnabled(Boolean(json.enabled));
    } catch {
      setEnabled(prev);
      setError("Could not update visibility.");
    } finally {
      setBusy(false);
    }
  }

  const dark = appearance === "dark";

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        dark ? "border-white/10 bg-white/[0.04] text-white" : "border-border bg-card text-foreground"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label
            htmlFor="reviews-visibility"
            className={cn("text-sm font-medium", dark && "text-white")}
          >
            Show reviews on storefront
          </Label>
          <p className={cn("text-xs leading-relaxed", dark ? "text-white/60" : "text-muted-foreground")}>
            When off, the product-page review section and homepage reviews strip are hidden.
            Moderation and existing reviews are kept. Use Hide/Reject on individual reviews to
            keep a single review private.
          </p>
        </div>
        <Switch
          id="reviews-visibility"
          checked={enabled}
          disabled={busy}
          onCheckedChange={(v) => void onToggle(v)}
          aria-label="Toggle storefront reviews visibility"
        />
      </div>
      <p className={cn("mt-3 text-xs font-medium", enabled ? (dark ? "text-emerald-300" : "text-emerald-700") : dark ? "text-amber-200" : "text-amber-700")}>
        Storefront reviews are {enabled ? "ON" : "OFF"}
      </p>
      {error ? (
        <p className={cn("mt-2 text-xs", dark ? "text-red-300" : "text-destructive")}>{error}</p>
      ) : null}
    </div>
  );
}
