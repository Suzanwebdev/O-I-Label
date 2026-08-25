import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RestockDemandSummary } from "@/lib/restock-notifications/demand-analytics";

type Props = {
  demand: RestockDemandSummary;
};

function DemandList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={`${title}-${item.label}`}
            className="flex items-baseline justify-between gap-4 text-sm"
          >
            <span className="min-w-0 truncate text-foreground">{item.label}</span>
            <span className="shrink-0 tabular-nums font-medium text-foreground">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Compact read-only restock demand summary for the admin product edit page.
 */
export function RestockDemandPanel({ demand }: Props) {
  const { active, historical } = demand;
  const hasAnyHistory =
    active.total > 0 || historical.notified > 0 || historical.unsubscribedOrCancelled > 0;

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Restock Demand</CardTitle>
        <CardDescription>
          Preferred sizes and colours from “Notify Me When Available”. Preferences guide restocking —
          they do not change who receives the restock email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasAnyHistory ? (
          <p className="text-sm text-muted-foreground">
            No customers are currently waiting for this product.
          </p>
        ) : (
          <>
            <div>
              <p className="text-sm text-muted-foreground">Current waiting</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                {active.total}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {active.total === 1 ? "customer" : "customers"}
                </span>
              </p>
              {(historical.notified > 0 || historical.unsubscribedOrCancelled > 0) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Previously notified: {historical.notified}
                  {" · "}
                  Unsubscribed/cancelled: {historical.unsubscribedOrCancelled}
                </p>
              )}
            </div>

            {active.total === 0 ? (
              <p className="text-sm text-muted-foreground">
                No customers are currently waiting for this product.
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <DemandList title="Preferred sizes" items={active.sizes} />
                <DemandList title="Preferred colours" items={active.colors} />
                <DemandList
                  title="Top requested combinations"
                  items={active.combinations.map((c) => ({
                    label: `${c.colorLabel} / ${c.sizeLabel}`,
                    count: c.count,
                  }))}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
