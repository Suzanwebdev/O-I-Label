import Link from "next/link";
import { Container } from "@/components/store/container";

export default function AccountOrdersPage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto w-full max-w-2xl space-y-5 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Account</p>
          <h1 className="font-serif-display text-3xl tracking-tight text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to see your order history and delivery updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login?next=/account/orders"
            className="rounded-[var(--radius-md)] border border-black bg-black px-4 py-2.5 text-sm text-white hover:bg-black/90"
          >
            Sign in to continue
          </Link>
          <Link
            href="/track-order"
            className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-2.5 text-sm hover:bg-muted"
          >
            Track order with number
          </Link>
        </div>
      </div>
    </Container>
  );
}

