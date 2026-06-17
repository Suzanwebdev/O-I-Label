import Link from "next/link";
import { Price } from "@/components/store/price";
import { Button } from "@/components/ui/button";

type OrderSummary = {
  order_number: string;
  total_ghs: number;
  email: string;
  items: Array<{ name: string; quantity: number; unit_price_ghs: number }>;
};

export function CheckoutSuccessSummary({ order }: { order: OrderSummary }) {
  return (
    <div className="mx-auto mt-8 max-w-md rounded-[var(--radius-lg)] border border-border bg-card p-5 text-left shadow-[var(--shadow-soft)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order summary</p>
      <p className="mt-2 font-serif-display text-xl">{order.order_number}</p>
      <p className="mt-1 text-xs text-muted-foreground">Confirmation sent to {order.email}</p>
      <ul className="mt-4 divide-y divide-border text-sm">
        {order.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-3 py-2">
            <span className="min-w-0">
              {item.name}
              <span className="text-muted-foreground"> × {item.quantity}</span>
            </span>
            <Price amountGhs={item.unit_price_ghs * item.quantity} className="shrink-0 text-sm" />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-border pt-3 font-medium">
        <span>Total</span>
        <Price amountGhs={order.total_ghs} />
      </div>
      <Button asChild variant="outline" className="mt-4 w-full">
        <Link
          href={`/track-order?order=${encodeURIComponent(order.order_number)}&email=${encodeURIComponent(order.email)}`}
        >
          Track this order
        </Link>
      </Button>
    </div>
  );
}
