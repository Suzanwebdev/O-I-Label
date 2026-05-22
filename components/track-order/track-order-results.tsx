import type { PublicOrderTracking } from "@/lib/types/public-order-tracking";

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

export function TrackOrderResults({ result }: { result: PublicOrderTracking }) {
  return (
    <div
      id="track-order-status"
      className="space-y-4 rounded-[var(--radius-md)] border border-border bg-muted/30 p-5 scroll-mt-24"
    >
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
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Shipping</p>
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
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Items</p>
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
  );
}
