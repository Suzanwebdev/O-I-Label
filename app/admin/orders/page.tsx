import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminOrdersTable } from "@/components/admin/admin-orders-table";
import { getAdminOrdersKpi, listAdminOrders } from "@/lib/data/admin";

export default async function AdminOrdersPage() {
  const [orders, kpi] = await Promise.all([listAdminOrders(), getAdminOrdersKpi()]);

  const cards = [
    { label: "Pending", value: kpi.pending },
    { label: "Processing", value: kpi.processing },
    { label: "Shipped", value: kpi.shipped },
    { label: "Delivered", value: kpi.delivered },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-serif-display text-2xl">Orders</h1>
      <p className="text-sm text-muted-foreground">
        Follow each order from payment through fulfillment. Update status,
        tracking, and customer notification preferences in one workflow.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Paid pipeline value</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">GHc {kpi.revenuePaid.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sum of paid, processing, shipped, and delivered orders.
          </p>
        </CardContent>
      </Card>
      <AdminOrdersTable orders={orders} />
    </div>
  );
}
