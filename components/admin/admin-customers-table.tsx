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
import type { AdminCustomerRow } from "@/lib/data/admin";

type Segment = "all" | "new30d" | "repeat" | "highValue";

export function AdminCustomersTable({ customers }: { customers: AdminCustomerRow[] }) {
  const router = useRouter();
  const [segment, setSegment] = React.useState<Segment>("all");
  const [q, setQ] = React.useState("");
  const [openCustomerId, setOpenCustomerId] = React.useState<string | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<{
    customer: {
      id: string;
      email: string | null;
      full_name: string | null;
      phone: string | null;
      tags: string[];
      total_spend_ghs: number;
      created_at: string;
    };
    addresses: Array<{
      id: string;
      line1: string;
      line2: string | null;
      city: string;
      region: string | null;
      country: string;
      is_default: boolean;
      created_at: string;
    }>;
    orders: Array<{
      id: string;
      order_number: string;
      status: string;
      total_ghs: number;
      created_at: string;
    }>;
  } | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");

  const filtered = React.useMemo(() => {
    const key = q.trim().toLowerCase();
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return customers.filter((c) => {
      if (segment === "new30d" && new Date(c.created_at).getTime() < since) return false;
      if (segment === "repeat" && c.orders_count < 2) return false;
      if (segment === "highValue" && c.total_spend_ghs < 1000) return false;
      if (!key) return true;
      return (
        (c.email ?? "").toLowerCase().includes(key) ||
        (c.full_name ?? "").toLowerCase().includes(key) ||
        (c.phone ?? "").toLowerCase().includes(key) ||
        c.tags.join(" ").toLowerCase().includes(key)
      );
    });
  }, [customers, q, segment]);

  async function openDetail(customerId: string) {
    setOpenCustomerId(customerId);
    setDetail(null);
    setDetailBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`);
      const json = (await res.json()) as { error?: string } & NonNullable<typeof detail>;
      if (!res.ok) {
        setError(json.error ?? "Could not load customer");
        return;
      }
      setDetail(json);
      setFullName(json.customer.full_name ?? "");
      setPhone(json.customer.phone ?? "");
      setTagsInput((json.customer.tags ?? []).join(", "));
    } catch {
      setError("Network error while loading customer");
    } finally {
      setDetailBusy(false);
    }
  }

  async function saveCustomer() {
    if (!openCustomerId) return;
    setSaveBusy(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch(`/api/admin/customers/${openCustomerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          tags,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save customer");
        return;
      }
      await openDetail(openCustomerId);
      router.refresh();
    } catch {
      setError("Network error while saving customer");
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={segment === "all" ? "default" : "outline"} onClick={() => setSegment("all")}>
          All ({customers.length})
        </Button>
        <Button size="sm" variant={segment === "new30d" ? "default" : "outline"} onClick={() => setSegment("new30d")}>
          New 30d
        </Button>
        <Button size="sm" variant={segment === "repeat" ? "default" : "outline"} onClick={() => setSegment("repeat")}>
          Repeat buyers
        </Button>
        <Button
          size="sm"
          variant={segment === "highValue" ? "default" : "outline"}
          onClick={() => setSegment("highValue")}
        >
          High value
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
          placeholder="Search by name, email, phone, tags..."
        />
        <p className="text-sm text-muted-foreground">{filtered.length} customers</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2">Orders</th>
              <th className="px-3 py-2">Total spend</th>
              <th className="px-3 py-2">Last order</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-3">
                  <p className="font-medium">{c.full_name ?? "Unnamed customer"}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                </td>
                <td className="px-3 py-3">{c.phone ?? "-"}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.length ? c.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {tag}
                      </span>
                    )) : <span className="text-xs text-muted-foreground">No tags</span>}
                  </div>
                </td>
                <td className="px-3 py-3">{c.orders_count}</td>
                <td className="px-3 py-3">GHc {c.total_spend_ghs.toFixed(2)}</td>
                <td className="px-3 py-3 text-muted-foreground">
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => void openDetail(c.id)}>
                    Detail
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No customers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Sheet open={Boolean(openCustomerId)} onOpenChange={(open) => !open && setOpenCustomerId(null)}>
        <SheetContent className="w-full max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Customer detail</SheetTitle>
            <SheetDescription>Profile, tags, addresses, and order history.</SheetDescription>
          </SheetHeader>
          {detailBusy ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading customer...</p>
          ) : detail ? (
            <div className="mt-6 space-y-6 text-sm">
              <section className="space-y-2">
                <h3 className="font-medium">Profile</h3>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
                <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Tags (comma separated)" />
                <Button size="sm" onClick={() => void saveCustomer()} disabled={saveBusy}>
                  {saveBusy ? "Saving..." : "Save customer"}
                </Button>
              </section>
              <section>
                <h3 className="font-medium">Addresses</h3>
                <ul className="mt-2 space-y-2">
                  {detail.addresses.map((a) => (
                    <li key={a.id} className="rounded border p-2 text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}
                      </p>
                      <p>
                        {a.city}
                        {a.region ? `, ${a.region}` : ""} • {a.country}
                      </p>
                      {a.is_default ? <p className="text-xs">Default</p> : null}
                    </li>
                  ))}
                  {detail.addresses.length === 0 ? <li className="text-muted-foreground">No addresses.</li> : null}
                </ul>
              </section>
              <section>
                <h3 className="font-medium">Recent orders</h3>
                <ul className="mt-2 space-y-2">
                  {detail.orders.map((o) => (
                    <li key={o.id} className="rounded border p-2 text-muted-foreground">
                      {o.order_number} • {o.status} • GHc {o.total_ghs.toFixed(2)} •{" "}
                      {new Date(o.created_at).toLocaleDateString()}
                    </li>
                  ))}
                  {detail.orders.length === 0 ? <li className="text-muted-foreground">No orders yet.</li> : null}
                </ul>
              </section>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Select a customer to view details.</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
