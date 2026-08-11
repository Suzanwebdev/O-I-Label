import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/store/container";
import { Price } from "@/components/store/price";
import { getAccountOrderById, getAccountSession } from "@/lib/data/account-orders";
import { orderStatusLabel } from "@/lib/orders/status-labels";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getEligibleItemsForCustomer } from "@/lib/reviews/eligibility";
import { formatPurchasedVariantLine } from "@/lib/reviews/types";
import { isOrderPaid } from "@/lib/admin/order-status";

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
    const { user } = await getAccountSession();
    if (!user) redirect("/login?next=/account/orders");
    notFound();
  }

  const { user } = await getAccountSession();
  const eligible =
    user?.id && order.paid_at
      ? await getEligibleItemsForCustomer(user.id)
      : [];
  const eligibleByItem = new Map(eligible.map((e) => [e.order_item_id, e]));

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const placed = new Date(String(order.created_at)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const paid = isOrderPaid({
    payment_status: order.paid_at ? "paid" : null,
    paid_at: order.paid_at ?? null,
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
            {items.map((item, i) => {
              const itemId = item.id ? String(item.id) : "";
              const variantJoin = item.variants;
              const variantObj = Array.isArray(variantJoin) ? variantJoin[0] : variantJoin;
              const color =
                variantObj && typeof variantObj === "object" && "color" in variantObj
                  ? ((variantObj as { color?: string | null }).color ?? null)
                  : null;
              const size =
                variantObj && typeof variantObj === "object" && "size" in variantObj
                  ? ((variantObj as { size?: string | null }).size ?? null)
                  : null;
              const variantLine = formatPurchasedVariantLine(color, size);
              const products = item.products;
              const productObj = Array.isArray(products) ? products[0] : products;
              const slug =
                productObj && typeof productObj === "object" && "slug" in productObj
                  ? String((productObj as { slug?: string }).slug ?? "")
                  : "";
              const elig = itemId ? eligibleByItem.get(itemId) : undefined;

              return (
                <li key={itemId || i} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{String(item.name)}</p>
                    {variantLine ? (
                      <p className="text-xs text-muted-foreground">{variantLine}</p>
                    ) : item.sku ? (
                      <p className="text-xs text-muted-foreground">{String(item.sku)}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">Qty {Number(item.quantity)}</p>
                    {paid && item.product_id && slug ? (
                      <p className="mt-2 text-xs">
                        {elig?.already_reviewed ? (
                          <span className="text-emerald-800">✓ Reviewed</span>
                        ) : elig ? (
                          <Link
                            href={`/product/${slug}`}
                            className="font-medium text-navy underline-offset-4 hover:underline"
                          >
                            Write a Review
                          </Link>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <Price amountGhs={Number(item.unit_price_ghs) * Number(item.quantity)} />
                </li>
              );
            })}
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
