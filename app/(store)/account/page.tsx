import Link from "next/link";
import { Container } from "@/components/store/container";

export default function AccountPage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto w-full max-w-2xl space-y-6 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Account</p>
          <h1 className="font-serif-display text-3xl tracking-tight text-foreground">Your profile</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to view profile details, saved addresses, and recent activity.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/account/orders"
            className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm hover:bg-muted"
          >
            View orders
          </Link>
          <Link
            href="/account/wishlist"
            className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm hover:bg-muted"
          >
            Wishlist
          </Link>
          <Link
            href="/track-order"
            className="rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm hover:bg-muted"
          >
            Track an order
          </Link>
          <Link
            href="/login?next=/account"
            className="rounded-[var(--radius-md)] border border-black bg-black px-4 py-3 text-sm text-white hover:bg-black/90"
          >
            Sign in
          </Link>
        </div>
      </div>
    </Container>
  );
}

