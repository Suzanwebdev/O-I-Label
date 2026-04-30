import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupportSnapshot } from "@/lib/data/admin";

export default async function AdminSupportCrmPage() {
  const data = await getSupportSnapshot();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Support CRM</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{data.openOrders}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending payments</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{data.pendingPayments}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Customers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{data.totalCustomers}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent orders needing attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recentOrders.length ? (
            data.recentOrders.map((o) => (
              <div key={o.id} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{o.order_number}</p>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{o.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{o.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  GHc {o.total_ghs.toFixed(2)} · {new Date(o.created_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No recent orders.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
