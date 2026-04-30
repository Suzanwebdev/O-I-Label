"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AdminOrderRow } from "@/lib/data/admin";

const statuses: AdminOrderRow["status"][] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

function tone(status: AdminOrderRow["status"]) {
  if (status === "delivered" || status === "paid") return "bg-emerald-100 text-emerald-800";
  if (status === "processing" || status === "shipped") return "bg-blue-100 text-blue-800";
  if (status === "cancelled" || status === "refunded") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}

export function AdminOrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [statusById, setStatusById] = React.useState<Record<string, AdminOrderRow["status"]>>(
    Object.fromEntries(orders.map((o) => [o.id, o.status])) as Record<string, AdminOrderRow["status"]>
  );
  const [notifyById, setNotifyById] = React.useState<Record<string, boolean>>(
    Object.fromEntries(orders.map((o) => [o.id, o.notify_customer])) as Record<string, boolean>
  );
  const [trackingById, setTrackingById] = React.useState<Record<string, string>>(
    Object.fromEntries(orders.map((o) => [o.id, o.tracking_number ?? ""])) as Record<string, string>
  );
  const [carrierById, setCarrierById] = React.useState<Record<string, string>>(
    Object.fromEntries(orders.map((o) => [o.id, o.carrier ?? ""])) as Record<string, string>
  );
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return orders;
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(key) ||
        o.email.toLowerCase().includes(key) ||
        o.status.toLowerCase().includes(key) ||
        (o.tracking_number ?? "").toLowerCase().includes(key)
    );
  }, [orders, q]);

  async function saveOrder(order: AdminOrderRow) {
    setBusyId(order.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          status: statusById[order.id] ?? order.status,
          notifyCustomer: notifyById[order.id] ?? order.notify_customer,
          trackingNumber: trackingById[order.id] ?? "",
          carrier: carrierById[order.id] ?? "",
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not update order");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while saving order");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
          placeholder="Search by order #, email, status, tracking..."
        />
        <p className="text-sm text-muted-foreground">{filtered.length} orders</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Tracking</th>
              <th className="px-3 py-2">Notify</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-t align-top">
                <td className="px-3 py-3 font-medium">{order.order_number}</td>
                <td className="px-3 py-3">{order.email}</td>
                <td className="px-3 py-3">GHc {order.total_ghs.toFixed(2)}</td>
                <td className="px-3 py-3">
                  <div className="space-y-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone(statusById[order.id] ?? order.status)}`}>
                      {(statusById[order.id] ?? order.status).toUpperCase()}
                    </span>
                    <select
                      value={statusById[order.id] ?? order.status}
                      onChange={(e) =>
                        setStatusById((prev) => ({
                          ...prev,
                          [order.id]: e.target.value as AdminOrderRow["status"],
                        }))
                      }
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-2">
                    <Input
                      value={trackingById[order.id] ?? ""}
                      onChange={(e) => setTrackingById((prev) => ({ ...prev, [order.id]: e.target.value }))}
                      placeholder="Tracking number"
                    />
                    <Input
                      value={carrierById[order.id] ?? ""}
                      onChange={(e) => setCarrierById((prev) => ({ ...prev, [order.id]: e.target.value }))}
                      placeholder="Carrier"
                    />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={notifyById[order.id] ?? order.notify_customer}
                      onChange={(e) => setNotifyById((prev) => ({ ...prev, [order.id]: e.target.checked }))}
                    />
                    customer
                  </label>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{new Date(order.created_at).toLocaleString()}</td>
                <td className="px-3 py-3 text-right">
                  <Button size="sm" disabled={busyId === order.id} onClick={() => void saveOrder(order)}>
                    {busyId === order.id ? "Saving..." : "Save"}
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
