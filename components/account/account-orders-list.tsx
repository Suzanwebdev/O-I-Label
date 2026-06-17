"use client";

import Link from "next/link";
import { Price } from "@/components/store/price";
import type { AccountOrderSummary } from "@/lib/data/account-orders";
import { orderStatusLabel } from "@/lib/orders/status-labels";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AccountOrdersList({ orders }: { orders: AccountOrderSummary[] }) {
  if (!orders.length) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">You haven&apos;t placed any orders yet.</p>
        <Link
          href="/shop"
          className="mt-4 inline-block text-sm font-medium text-navy underline-offset-4 hover:underline"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/account/orders/${order.id}`}
            className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-foreground">{order.order_number}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(order.created_at)}
                {order.item_count > 0 ? ` · ${order.item_count} item${order.item_count === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4 sm:text-right">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {orderStatusLabel(order.status)}
              </span>
              <Price amountGhs={order.total_ghs} className="text-sm font-semibold" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
