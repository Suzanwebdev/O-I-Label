"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { AdminDiscountRow } from "@/lib/data/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DiscountUpsertForm } from "@/components/admin/discount-upsert-form";

function formatValue(d: AdminDiscountRow): string {
  if (d.kind === "free_shipping") return "Free shipping";
  if (d.value == null) return "—";
  if (d.kind === "percent") return `${Number(d.value)}%`;
  return `${Number(d.value).toFixed(2)} GH₵`;
}

function usageLabel(d: AdminDiscountRow): string {
  if (d.usage_limit == null) return `${d.used_count} / ∞`;
  return `${d.used_count} / ${d.usage_limit}`;
}

function windowLabel(d: AdminDiscountRow): string {
  const s = d.starts_at ? new Date(d.starts_at).toLocaleString() : "—";
  const e = d.ends_at ? new Date(d.ends_at).toLocaleString() : "—";
  if (s === "—" && e === "—") return "Anytime";
  return `${s} → ${e}`;
}

function statusBadge(d: AdminDiscountRow): {
  label: string;
  variant: "default" | "secondary" | "outline";
  className?: string;
} {
  if (!d.is_active) return { label: "Off", variant: "outline" };
  const now = Date.now();
  if (d.starts_at && new Date(d.starts_at).getTime() > now) {
    return { label: "Scheduled", variant: "secondary" };
  }
  if (d.ends_at && new Date(d.ends_at).getTime() < now) {
    return { label: "Expired", variant: "outline" };
  }
  const atCap = d.usage_limit != null && d.used_count >= d.usage_limit;
  if (atCap) {
    return { label: "Used up", variant: "outline", className: "border-red-600 text-red-700" };
  }
  return { label: "Live", variant: "default" };
}

export function AdminDiscountsTable({ discounts }: { discounts: AdminDiscountRow[] }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<AdminDiscountRow | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function removeDiscount(id: string, code: string) {
    if (!window.confirm(`Delete discount "${code}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/discounts?discountId=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(json.error ?? "Could not delete");
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Min spend</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="min-w-[200px]">Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discounts.map((d) => {
              const st = statusBadge(d);
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-mono font-medium">{d.code}</TableCell>
                  <TableCell className="capitalize">{d.kind.replace(/_/g, " ")}</TableCell>
                  <TableCell>{formatValue(d)}</TableCell>
                  <TableCell className="tabular-nums">
                    {d.min_spend_ghs != null ? `${Number(d.min_spend_ghs).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{usageLabel(d)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{windowLabel(d)}</TableCell>
                  <TableCell>
                    <Badge variant={st.variant} className={st.className}>
                      {st.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEdit(d)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-red-700 text-red-700 hover:bg-red-50"
                        disabled={deletingId === d.id}
                        onClick={() => void removeDiscount(d.id, d.code)}
                      >
                        {deletingId === d.id ? "…" : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {discounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No discount codes yet. Create one above.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit discount</DialogTitle>
            <DialogDescription>Update eligibility, limits, schedule, or the code itself.</DialogDescription>
          </DialogHeader>
          {edit ? (
            <DiscountUpsertForm key={edit.id} existing={edit} onSuccess={() => setEdit(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
