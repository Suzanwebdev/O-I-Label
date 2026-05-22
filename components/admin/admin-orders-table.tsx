"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AdminOrderRow } from "@/lib/data/admin";
import { computeOrdersKpi } from "@/lib/admin/orders-kpi";
import {
  allowedFulfillmentStatuses,
  countOrdersForStatusFilter,
  fulfillmentTone,
  isOrderPaid,
  matchesOrderStatusFilter,
  paymentLabel,
  paymentTone,
} from "@/lib/admin/order-status";
import { formatOrderShippingAddressLines } from "@/lib/orders/format-address";
import { OrderItemPreviews } from "@/components/admin/order-item-previews";
import Image from "next/image";

const filterStatuses: AdminOrderRow["status"][] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export function AdminOrdersTable({ orders: initialOrders }: { orders: AdminOrderRow[] }) {
  const router = useRouter();
  const [orders, setOrders] = React.useState(initialOrders);
  const [q, setQ] = React.useState("");
  const [activeStatus, setActiveStatus] = React.useState<"all" | AdminOrderRow["status"]>("all");
  const [needsAttentionOnly, setNeedsAttentionOnly] = React.useState(false);
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [bulkStatus, setBulkStatus] = React.useState<AdminOrderRow["status"]>("processing");
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [statusById, setStatusById] = React.useState<Record<string, AdminOrderRow["status"]>>({});
  const [notifyById, setNotifyById] = React.useState<Record<string, boolean>>({});
  const [trackingById, setTrackingById] = React.useState<Record<string, string>>({});
  const [carrierById, setCarrierById] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setOrders(initialOrders);
    setStatusById((prev) => {
      const next = { ...prev };
      for (const order of initialOrders) {
        if (next[order.id] === order.status) delete next[order.id];
      }
      return next;
    });
    setNotifyById((prev) => {
      const next = { ...prev };
      for (const order of initialOrders) {
        if (next[order.id] === order.notify_customer) delete next[order.id];
      }
      return next;
    });
    setTrackingById((prev) => {
      const next = { ...prev };
      for (const order of initialOrders) {
        const saved = order.tracking_number ?? "";
        if ((next[order.id] ?? saved) === saved) delete next[order.id];
      }
      return next;
    });
    setCarrierById((prev) => {
      const next = { ...prev };
      for (const order of initialOrders) {
        const saved = order.carrier ?? "";
        if ((next[order.id] ?? saved) === saved) delete next[order.id];
      }
      return next;
    });
  }, [initialOrders]);

  const resolveStatus = React.useCallback(
    (order: AdminOrderRow) => statusById[order.id] ?? order.status,
    [statusById]
  );

  const kpi = React.useMemo(() => computeOrdersKpi(orders, resolveStatus), [orders, resolveStatus]);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<{
    order: {
      id: string;
      order_number: string;
      email: string;
      phone: string | null;
      status: string;
      paid_at: string | null;
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
    items: Array<{
      id: string;
      name: string;
      sku: string | null;
      unit_price_ghs: number;
      quantity: number;
      image: string | null;
    }>;
    payments: Array<{ id: string; provider: string; status: string; amount_ghs: number; reference: string | null; created_at: string }>;
    shipments: Array<{ id: string; carrier: string | null; tracking_number: string | null; status: string | null; created_at: string }>;
    events: Array<{ id: string; event_type: string; message: string; created_at: string }>;
    statusEvents: Array<{
      id: string;
      from_status: string | null;
      to_status: string;
      payment_status: string | null;
      note: string | null;
      created_at: string;
    }>;
  } | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);
  const [notifyBusy, setNotifyBusy] = React.useState(false);
  const [confirmPayBusy, setConfirmPayBusy] = React.useState(false);

  const filtered = React.useMemo(() => {
    const key = q.trim().toLowerCase();
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;
    return orders.filter((o) => {
      const status = resolveStatus(o);
      const tracking = trackingById[o.id] ?? o.tracking_number ?? "";
      const ageMs = Date.now() - new Date(o.created_at).getTime();
      const needsAttention =
        (((!isOrderPaid(o) && status === "pending") || status === "processing") &&
          ageMs > 24 * 60 * 60 * 1000) ||
        (status === "shipped" && !tracking.trim());
      if (needsAttentionOnly && !needsAttention) return false;
      if (activeStatus !== "all" && !matchesOrderStatusFilter(o, status, activeStatus)) return false;
      if (fromTime != null || toTime != null) {
        const ts = new Date(o.created_at).getTime();
        if (fromTime != null && ts < fromTime) return false;
        if (toTime != null && ts > toTime) return false;
      }
      if (!key) return true;
      return (
        o.order_number.toLowerCase().includes(key) ||
        o.email.toLowerCase().includes(key) ||
        (o.phone ?? "").toLowerCase().includes(key) ||
        (o.customer_name ?? "").toLowerCase().includes(key) ||
        (o.location_summary ?? "").toLowerCase().includes(key) ||
        status.toLowerCase().includes(key) ||
        paymentLabel(o).toLowerCase().includes(key) ||
        tracking.toLowerCase().includes(key)
      );
    });
  }, [orders, q, activeStatus, fromDate, toDate, needsAttentionOnly, resolveStatus, trackingById]);

  const selectedIds = React.useMemo(
    () => filtered.filter((o) => selected[o.id]).map((o) => o.id),
    [filtered, selected]
  );

  const statusCounts = React.useMemo(
    () => countOrdersForStatusFilter(orders, resolveStatus),
    [orders, resolveStatus]
  );

  function applySavedOrder(order: AdminOrderRow, patch: Partial<AdminOrderRow>) {
    setOrders((prev) => prev.map((row) => (row.id === order.id ? { ...row, ...patch } : row)));
    setStatusById((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });
  }

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
      const json = (await res.json()) as { error?: string; payment_status?: AdminOrderRow["payment_status"] };
      if (!res.ok) {
        setError(json.error ?? "Could not update order");
        return;
      }
      const nextStatus = statusById[order.id] ?? order.status;
      applySavedOrder(order, {
        status: nextStatus,
        payment_status: json.payment_status ?? order.payment_status,
        notify_customer: notifyById[order.id] ?? order.notify_customer,
        tracking_number: (trackingById[order.id] ?? order.tracking_number ?? "").trim() || null,
        carrier: (carrierById[order.id] ?? order.carrier ?? "").trim() || null,
      });
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
      setOrders((prev) =>
        prev.map((row) =>
          selectedIds.includes(row.id)
            ? {
                ...row,
                status: bulkStatus,
                payment_status: bulkStatus === "refunded" ? "refunded" : row.payment_status,
              }
            : row
        )
      );
      setStatusById((prev) => {
        const next = { ...prev };
        for (const id of selectedIds) delete next[id];
        return next;
      });
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

  async function confirmPayment() {
    if (!openOrderId) return;
    setConfirmPayBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${openOrderId}/confirm-payment`, { method: "POST" });
      const json = (await res.json()) as { error?: string; ok?: boolean; source?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not confirm payment");
        return;
      }
      setNotice("Payment confirmed. Order is now marked as paid.");
      await openDetail(openOrderId);
      router.refresh();
    } catch {
      setError("Network error while confirming payment");
    } finally {
      setConfirmPayBusy(false);
    }
  }

  async function sendUpdate() {
    if (!openOrderId) return;
    setNotifyBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${openOrderId}/notify`, { method: "POST" });
      const json = (await res.json()) as {
        error?: string;
        ok?: boolean;
        summary?: string;
        email?: { sent?: boolean; skipped?: boolean; reason?: string; error?: string };
        sms?: { sent?: boolean; skipped?: string; error?: string };
      };
      if (!res.ok) {
        setError(json.error ?? "Could not send update");
        return;
      }
      if (json.ok) {
        setNotice(json.summary ?? "Update sent to the customer.");
      } else {
        setError(
          json.summary ??
            "Nothing was delivered. Check Vercel env: RESEND_API_KEY, RESEND_FROM (verified domain), MOOLRE_SMS_VASKEY, MOOLRE_SMS_SENDER_ID."
        );
      }
      await openDetail(openOrderId);
      router.refresh();
    } catch {
      setError("Network error while sending update");
    } finally {
      setNotifyBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Pending", value: kpi.pending },
          { label: "Processing", value: kpi.processing },
          { label: "Shipped", value: kpi.shipped },
          { label: "Delivered", value: kpi.delivered },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Paid pipeline value</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">GHc {kpi.revenuePaid.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sum of orders with confirmed payment (excludes cancelled and refunded).
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeStatus === "all" ? "default" : "outline"}
          onClick={() => setActiveStatus("all")}
        >
          All ({orders.length})
        </Button>
        {filterStatuses.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={activeStatus === s ? "default" : "outline"}
            onClick={() => setActiveStatus(s)}
          >
            {s} ({statusCounts[s]})
          </Button>
        ))}
        <Button
          size="sm"
          variant={needsAttentionOnly ? "default" : "outline"}
          onClick={() => setNeedsAttentionOnly((v) => !v)}
        >
          Needs attention
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-[320px]"
            placeholder="Search order #, email, phone, city, tracking..."
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
            {(["processing", "shipped", "delivered", "refunded", "cancelled"] as const).map((s) => (
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
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
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
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Fulfillment</th>
              <th className="px-3 py-2">Tracking</th>
              <th className="px-3 py-2">Notify</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => {
              const status = resolveStatus(order);
              return (
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
                <td className="px-3 py-3">
                  <div className="space-y-2">
                    <p className="font-medium">{order.order_number}</p>
                    <OrderItemPreviews
                      items={order.preview_items}
                      totalCount={order.item_count}
                    />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="max-w-[220px] space-y-0.5">
                    {order.customer_name ? (
                      <p className="font-medium text-foreground">{order.customer_name}</p>
                    ) : null}
                    <p className="break-all">{order.email}</p>
                    {order.phone ? (
                      <p className="text-muted-foreground">
                        <a href={`tel:${order.phone.replace(/\s/g, "")}`} className="hover:underline">
                          {order.phone}
                        </a>
                      </p>
                    ) : null}
                    {order.location_summary ? (
                      <p className="text-xs text-muted-foreground">{order.location_summary}</p>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3">GHc {order.total_ghs.toFixed(2)}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${paymentTone(order.payment_status)}`}
                    title={order.paid_at ? `Paid ${new Date(order.paid_at).toLocaleString()}` : undefined}
                  >
                    {paymentLabel(order)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${fulfillmentTone(status)}`}>
                      {status.toUpperCase()}
                    </span>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatusById((prev) => ({
                          ...prev,
                          [order.id]: e.target.value as AdminOrderRow["status"],
                        }))
                      }
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      {allowedFulfillmentStatuses(order).map((s) => (
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
                      value={trackingById[order.id] ?? order.tracking_number ?? ""}
                      onChange={(e) => setTrackingById((prev) => ({ ...prev, [order.id]: e.target.value }))}
                      placeholder="Tracking number"
                    />
                    <Input
                      value={carrierById[order.id] ?? order.carrier ?? ""}
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
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Sheet
        open={Boolean(openOrderId)}
        onOpenChange={(open) => {
          if (!open) {
            setOpenOrderId(null);
            setNotice(null);
            setError(null);
          }
        }}
      >
        <SheetContent className="w-full max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Order detail</SheetTitle>
            <SheetDescription>Customer, payment, shipment, and timeline information.</SheetDescription>
          </SheetHeader>
          {notice ? <p className="mt-4 text-sm text-emerald-700">{notice}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          {detailBusy ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading order...</p>
          ) : detail ? (
            <div className="mt-6 space-y-6 text-sm">
              <section className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/api/admin/orders/${detail.order.id}/invoice`, "_blank")}
                >
                  Print invoice
                </Button>
                {!detail.payments.some((p) => p.status === "paid") && !detail.order.paid_at ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void confirmPayment()}
                    disabled={confirmPayBusy}
                  >
                    {confirmPayBusy ? "Confirming..." : "Confirm payment"}
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => void sendUpdate()} disabled={notifyBusy}>
                  {notifyBusy ? "Sending..." : "Send customer update"}
                </Button>
              </section>
              <section>
                <h3 className="font-medium">Customer &amp; delivery</h3>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p>
                    <span className="text-foreground">Email:</span> {detail.order.email}
                  </p>
                  {detail.order.phone ? (
                    <p>
                      <span className="text-foreground">Phone:</span>{" "}
                      <a
                        href={`tel:${detail.order.phone.replace(/\s/g, "")}`}
                        className="hover:underline"
                      >
                        {detail.order.phone}
                      </a>
                    </p>
                  ) : (
                    <p className="text-amber-700">No phone on file</p>
                  )}
                  {formatOrderShippingAddressLines(
                    detail.order.shipping_address,
                    detail.order.phone
                  ).length > 0 ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-foreground">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Ship to
                      </p>
                      {formatOrderShippingAddressLines(
                        detail.order.shipping_address,
                        detail.order.phone
                      ).map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-amber-700">No delivery address on file</p>
                  )}
                </div>
              </section>
              <section>
                <h3 className="font-medium">Summary</h3>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p>Order: {detail.order.order_number}</p>
                  <p>
                    Payment:{" "}
                    {detail.payments.some((p) => p.status === "paid")
                      ? "Paid"
                      : detail.payments[0]?.status ?? "Unpaid"}
                    {detail.order.paid_at
                      ? ` (${new Date(detail.order.paid_at).toLocaleString()})`
                      : ""}
                  </p>
                  <p>Fulfillment: {detail.order.status}</p>
                  <p>Total: GHc {detail.order.total_ghs.toFixed(2)}</p>
                </div>
              </section>
              <section>
                <h3 className="font-medium">Items</h3>
                <ul className="mt-2 space-y-2">
                  {detail.items.map((item) => (
                    <li key={item.id} className="flex gap-3 rounded border p-2">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        <Image
                          src={item.image || "/file.svg"}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.sku ?? "No SKU"} • Qty {item.quantity} • GHc{" "}
                          {item.unit_price_ghs.toFixed(2)}
                        </p>
                      </div>
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
                <h3 className="font-medium">Status history</h3>
                <ul className="mt-2 space-y-2">
                  {detail.statusEvents.map((ev) => (
                    <li key={ev.id} className="rounded border p-2 text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {ev.from_status ? `${ev.from_status} → ${ev.to_status}` : ev.to_status}
                        {ev.payment_status ? ` (payment: ${ev.payment_status})` : ""}
                      </p>
                      {ev.note ? <p>{ev.note}</p> : null}
                      <p className="text-xs">{new Date(ev.created_at).toLocaleString()}</p>
                    </li>
                  ))}
                  {detail.statusEvents.length === 0 ? (
                    <li className="text-muted-foreground">No status changes recorded yet.</li>
                  ) : null}
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
