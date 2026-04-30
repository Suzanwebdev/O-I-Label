import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminCustomersTable } from "@/components/admin/admin-customers-table";
import { getAdminCustomersKpi, listAdminCustomers } from "@/lib/data/admin";

export default async function AdminCustomersPage() {
  const [customers, kpi] = await Promise.all([listAdminCustomers(), getAdminCustomersKpi()]);

  const cards = [
    { label: "Total customers", value: kpi.total.toString() },
    { label: "New (30d)", value: kpi.new30d.toString() },
    { label: "Repeat buyers", value: kpi.repeat.toString() },
    { label: "High value", value: kpi.highValue.toString() },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-serif-display text-2xl">Customers</h1>
      <p className="text-sm text-muted-foreground">
        Customer intelligence across profile, purchase behavior, and loyalty
        segments for CRM-ready operations.
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
          <CardTitle className="text-sm font-medium text-muted-foreground">Average lifetime value</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">GHc {kpi.avgLifetimeValue.toFixed(2)}</p>
        </CardContent>
      </Card>
      <AdminCustomersTable customers={customers} />
    </div>
  );
}
