import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSnapshot } from "@/lib/data/admin";

export default async function AdminDashboardPage() {
  const stats = await getDashboardSnapshot();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue (30d)", value: `GHc ${stats.revenue30d.toFixed(2)}` },
          { label: "Paid orders (30d)", value: stats.orders30d.toString() },
          { label: "AOV (paid)", value: `GHc ${stats.aov30d.toFixed(2)}` },
          { label: "Paid rate", value: `${stats.paidRatePct.toFixed(1)}%` },
        ].map((k) => (
          <Card key={k.label} className="rounded-[var(--radius-lg)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-[var(--radius-lg)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Newsletter subscribers
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums">
            {stats.newsletterTotal.toLocaleString()}
          </p>
          <Link
            href="/admin/newsletter"
            className="text-sm text-navy underline-offset-4 hover:underline"
          >
            View list
          </Link>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Metrics are sourced from live Supabase data and update as orders and payments change.
      </p>
    </div>
  );
}
