import Link from "next/link";
import { TrackOrderResults } from "@/components/track-order/track-order-results";
import { TrackOrderScrollAnchor } from "@/components/track-order/track-order-scroll";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupOrderForTracking } from "@/lib/data/track-order";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Track Your Order",
  description:
    "Track your O & I Label order status with your order number and email. Fast updates on premium women's fashion deliveries.",
  path: "/track-order",
});

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ order?: string; email?: string; orderNumber?: string }>;
};

export default async function TrackOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderInput = (params.order ?? params.orderNumber ?? "").trim();
  const emailInput = (params.email ?? "").trim();
  const submitted = Boolean(orderInput && emailInput);

  let result = null;
  let error: string | null = null;

  if (submitted) {
    if (!emailInput.includes("@")) {
      error = "Enter the same valid email address you used at checkout.";
    } else {
      result = await lookupOrderForTracking(orderInput, emailInput);
      if (!result) {
        error =
          "We could not find an order with that number and email. Check both fields and try again.";
      }
    }
  }

  return (
    <Container className="py-10 md:py-14">
      <TrackOrderScrollAnchor active={submitted} />
      <div className="mx-auto w-full max-w-2xl space-y-6 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Support</p>
          <h1 className="font-serif-display text-3xl tracking-tight text-foreground">Track your order</h1>
          <p className="text-sm text-muted-foreground">
            Enter your order number and email to check delivery status.
          </p>
        </div>

        <form method="get" action="/track-order" className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="track-order-number">Order number</Label>
            <Input
              id="track-order-number"
              name="order"
              placeholder="e.g. OI-20260522-ABC123"
              defaultValue={orderInput}
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="track-order-email">Email address</Label>
            <Input
              id="track-order-email"
              name="email"
              type="email"
              placeholder="Email used at checkout"
              defaultValue={emailInput}
              autoComplete="email"
              required
            />
          </div>
          <Button type="submit" className="sm:col-span-2">
            Check status
          </Button>
        </form>

        {error ? (
          <p
            id="track-order-status"
            className="scroll-mt-24 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {result ? <TrackOrderResults result={result} /> : null}

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
