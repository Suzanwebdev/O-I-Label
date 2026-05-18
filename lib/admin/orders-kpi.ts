import type { AdminOrderRow, AdminOrdersKpi } from "@/lib/data/admin";
import { isOrderPaid } from "@/lib/admin/order-status";

export function computeOrdersKpi(
  orders: AdminOrderRow[],
  resolveStatus: (order: AdminOrderRow) => AdminOrderRow["status"]
): AdminOrdersKpi {
  const kpi: AdminOrdersKpi = {
    pending: 0,
    paid: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
    revenuePaid: 0,
  };

  for (const order of orders) {
    const status = resolveStatus(order);
    kpi[status] += 1;
    if (isOrderPaid(order) && status !== "cancelled" && order.payment_status !== "refunded") {
      kpi.revenuePaid += Number(order.total_ghs ?? 0);
    }
  }

  return kpi;
}
