import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsSnapshot } from "@/lib/data/admin";

export default async function AdminAnalyticsPage() {
  const stats = await getAnalyticsSnapshot();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{stats.totalOrders}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Paid orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{stats.paidOrders}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gross revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">GHc {stats.grossRevenue.toFixed(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active products</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{stats.activeProducts}</CardContent>
        </Card>
      </div>
    </div>
  );
}
