import { AdminOrdersTable } from "@/components/admin/admin-orders-table";
import { listAdminOrders } from "@/lib/data/admin";

export default async function AdminOrdersPage() {
  const orders = await listAdminOrders();

  return (
    <div className="space-y-6">
      <h1 className="font-serif-display text-2xl">Orders</h1>
      <p className="text-sm text-muted-foreground">
        Follow each order from payment through fulfillment. Update status,
        tracking, and customer notification preferences in one workflow.
      </p>
      <AdminOrdersTable orders={orders} />
    </div>
  );
}
