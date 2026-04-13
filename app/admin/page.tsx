import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif-display text-2xl">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue (30d)", value: "—" },
          { label: "Orders", value: "—" },
          { label: "AOV", value: "—" },
          { label: "Conversion", value: "—" },
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
      <p className="text-sm text-muted-foreground">
        Connect Supabase and staff accounts to populate live metrics. Charts and
        funnels can be enabled via the advanced analytics feature flag.
      </p>
    </div>
  );
}
