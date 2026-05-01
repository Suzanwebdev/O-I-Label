import Link from "next/link";
import { Container } from "@/components/store/container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function TrackOrderPage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto w-full max-w-2xl space-y-6 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Support</p>
          <h1 className="font-serif-display text-3xl tracking-tight text-foreground">Track your order</h1>
          <p className="text-sm text-muted-foreground">
            Enter your order number and email to check delivery status.
          </p>
        </div>

        <form className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Order number (e.g. OIL-2041)" aria-label="Order number" />
          <Input type="email" placeholder="Email address" aria-label="Email address" />
          <Button type="button" className="sm:col-span-2">
            Check status
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          Need account-based history?{" "}
          <Link href="/login?next=/account/orders" className="text-navy underline-offset-4 hover:underline">
            Sign in
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}

