"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [activeStatus, setActiveStatus] = React.useState<"all" | AdminOrderRow["status"]>("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [bulkStatus, setBulkStatus] = React.useState<AdminOrderRow["status"]>("processing");
  const [bulkBusy, setBulkBusy] = React.useState(false);
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
  const [openOrderId, setOpenOrderId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<{
    order: {
      id: string;
      order_number: string;
      email: string;
      phone: string | null;
      status: string;
      subtotal_ghs: number;
      shipping_ghs: number;
      tax_ghs: number;
      discount_ghs: number;
      total_ghs: number;
      created_at: string;
      updated_at: string;
      notes: string | null;
      shipping_address: Record<string, unknown> | null;
      billing_address: Record<string, unknown> | null;
    };
    items: Array<{ id: string; name: string; sku: string | null; unit_price_ghs: number; quantity: number }>;
    payments: Array<{ id: string; provider: string; status: string; amount_ghs: number; reference: string | null; created_at: string }>;
    shipments: Array<{ id: string; carrier: string | null; tracking_number: string | null; status: string | null; created_at: string }>;
    events: Array<{ id: string; event_type: string; message: string; created_at: string }>;
  } | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);

  const filtered = React.useMemo(() => {
    const key = q.trim().toLowerCase();
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;
    return orders.filter((o) => {
      if (activeStatus !== "all" && o.status !== activeStatus) return false;
      if (fromTime != null || toTime != null) {
        const ts = new Date(o.created_at).getTime();
        if (fromTime != null && ts < fromTime) return false;
        if (toTime != null && ts > toTime) return false;
      }
      if (!key) return true;
      return (
        o.order_number.toLowerCase().includes(key) ||
        o.email.toLowerCase().includes(key) ||
        o.status.toLowerCase().includes(key) ||
        (o.tracking_number ?? "").toLowerCase().includes(key)
      );
    });
  }, [orders, q, activeStatus, fromDate, toDate]);

  const selectedIds = React.useMemo(
    () => filtered.filter((o) => selected[o.id]).map((o) => o.id),
    [filtered, selected]
  );

  const statusCounts = React.useMemo(() => {
    const counts: Record<AdminOrderRow["status"], number> = {
      pending: 0,
      paid: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      refunded: 0,
    };
    for (const order of orders) counts[order.status] += 1;
    return counts;
  }, [orders]);

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

  async function applyBulkStatus() {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedIds, status: bulkStatus }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Bulk update failed");
        return;
      }
      setSelected({});
      router.refresh();
    } catch {
      setError("Network error while applying bulk update");
    } finally {
      setBulkBusy(false);
    }
  }

  async function openDetail(orderId: string) {
    setOpenOrderId(orderId);
    setDetail(null);
    setDetailBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const json = (await res.json()) as { error?: string } & typeof detail;
      if (!res.ok) {
        setError(json.error ?? "Could not load order detail");
        return;
      }
      setDetail(json);
    } catch {
      setError("Network error while loading order detail");
    } finally {
      setDetailBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeStatus === "all" ? "default" : "outline"}
          onClick={() => setActiveStatus("all")}
        >
          All ({orders.length})
        </Button>
        {statuses.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={activeStatus === s ? "default" : "outline"}
            onClick={() => setActiveStatus(s)}
          >
            {s} ({statusCounts[s]})
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-[320px]"
            placeholder="Search by order #, email, status, tracking..."
          />
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[170px]" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[170px]" />
        </div>
        <p className="text-sm text-muted-foreground">{filtered.length} orders</p>
      </div>
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-sm">{selectedIds.length} selected</p>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as AdminOrderRow["status"])}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={bulkBusy} onClick={() => void applyBulkStatus()}>
            {bulkBusy ? "Applying..." : "Apply status"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(Object.fromEntries(filtered.map((o) => [o.id, true])));
                    } else {
                      setSelected({});
                    }
                  }}
                />
              </th>
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
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[order.id])}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [order.id]: e.target.checked,
                      }))
                    }
                  />
                </td>
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
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => void openDetail(order.id)}>
                      Detail
                    </Button>
                    <Button size="sm" disabled={busyId === order.id} onClick={() => void saveOrder(order)}>
                      {busyId === order.id ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Sheet open={Boolean(openOrderId)} onOpenChange={(open) => !open && setOpenOrderId(null)}>
        <SheetContent className="w-full max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Order detail</SheetTitle>
            <SheetDescription>Customer, payment, shipment, and timeline information.</SheetDescription>
          </SheetHeader>
          {detailBusy ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading order...</p>
          ) : detail ? (
            <div className="mt-6 space-y-6 text-sm">
              <section>
                <h3 className="font-medium">Summary</h3>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p>Order: {detail.order.order_number}</p>
                  <p>Status: {detail.order.status}</p>
                  <p>Email: {detail.order.email}</p>
                  <p>Total: GHc {detail.order.total_ghs.toFixed(2)}</p>
                </div>
              </section>
              <section>
                <h3 className="font-medium">Items</h3>
                <ul className="mt-2 space-y-2">
                  {detail.items.map((item) => (
                    <li key={item.id} className="rounded border p-2">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.sku ?? "No SKU"} • Qty {item.quantity} • GHc {item.unit_price_ghs.toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="font-medium">Payments</h3>
                <ul className="mt-2 space-y-2">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="rounded border p-2 text-muted-foreground">
                      {p.provider} • {p.status} • GHc {p.amount_ghs.toFixed(2)} •{" "}
                      {new Date(p.created_at).toLocaleString()}
                    </li>
                  ))}
                  {detail.payments.length === 0 ? <li className="text-muted-foreground">No payments recorded.</li> : null}
                </ul>
              </section>
              <section>
                <h3 className="font-medium">Shipments</h3>
                <ul className="mt-2 space-y-2">
                  {detail.shipments.map((s) => (
                    <li key={s.id} className="rounded border p-2 text-muted-foreground">
                      {s.carrier ?? "Carrier N/A"} • {s.tracking_number ?? "No tracking"} • {s.status ?? "Unknown"}
                    </li>
                  ))}
                  {detail.shipments.length === 0 ? <li className="text-muted-foreground">No shipment yet.</li> : null}
                </ul>
              </section>
              <section>
                <h3 className="font-medium">Timeline</h3>
                <ul className="mt-2 space-y-2">
                  {detail.events.map((ev) => (
                    <li key={ev.id} className="rounded border p-2 text-muted-foreground">
                      <p className="font-medium text-foreground">{ev.event_type}</p>
                      <p>{ev.message}</p>
                      <p className="text-xs">{new Date(ev.created_at).toLocaleString()}</p>
                    </li>
                  ))}
                  {detail.events.length === 0 ? <li className="text-muted-foreground">No events yet.</li> : null}
                </ul>
              </section>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Select an order to view details.</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
