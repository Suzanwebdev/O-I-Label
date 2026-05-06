import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  return (
    <div className="border-b border-border/60 bg-background py-10 md:py-12">
      <Container>
        <div className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center md:p-8">
          <h1 className="font-serif-display text-3xl font-semibold tracking-tight">Checkout</h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Secure checkout is currently being finalized. Please review your bag and continue shopping while we roll
            out the full payment flow.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/cart">Back to bag</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/shop">Continue shopping</Link>
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
