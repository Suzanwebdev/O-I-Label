import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/store/container";
import { Price } from "@/components/store/price";
import { getAccountOrderById } from "@/lib/data/account-orders";
import { orderStatusLabel } from "@/lib/orders/status-labels";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Order details",
  description: "View your O & I Label order details.",
  path: "/account/orders",
  noIndex: true,
});

type Props = { params: Promise<{ orderId: string }> };

export default async function AccountOrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const order = await getAccountOrderById(orderId);

  if (order === null) {
    const { user } = await import("@/lib/data/account-orders").then((m) => m.getAccountSession());
    if (!user) redirect("/login?next=/account/orders");
    notFound();
  }

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const placed = new Date(String(order.created_at)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <Link href="/account/orders" className="text-sm text-navy underline-offset-4 hover:underline">
            ← All orders
          </Link>
          <h1 className="font-serif-display text-3xl tracking-tight">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {placed} · {orderStatusLabel(String(order.status))}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</h2>
          <ul className="mt-3 divide-y divide-border">
            {items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{String(item.name)}</p>
                  {item.sku ? <p className="text-xs text-muted-foreground">{String(item.sku)}</p> : null}
                  <p className="text-xs text-muted-foreground">Qty {Number(item.quantity)}</p>
                </div>
                <Price amountGhs={Number(item.unit_price_ghs) * Number(item.quantity)} />
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="font-medium">Total</span>
            <Price amountGhs={Number(order.total_ghs)} className="text-lg font-semibold" />
          </div>
        </div>

        <Link
          href={`/track-order?order=${encodeURIComponent(String(order.order_number))}`}
          className="inline-block text-sm font-medium text-navy underline-offset-4 hover:underline"
        >
          Track this order
        </Link>
      </div>
    </Container>
  );
}
