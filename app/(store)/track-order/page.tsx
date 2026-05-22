import { TrackOrderForm } from "@/components/track-order/track-order-form";
import { Container } from "@/components/store/container";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Track Your Order",
  description:
    "Track your O & I Label order status with your order number and email. Fast updates on premium women's fashion deliveries.",
  path: "/track-order",
});

type Props = {
  searchParams: Promise<{ order?: string; email?: string }>;
};

export default async function TrackOrderPage({ searchParams }: Props) {
  const { order: orderParam, email: emailParam } = await searchParams;

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

        <TrackOrderForm
          initialOrderNumber={orderParam?.trim() ?? ""}
          initialEmail={emailParam?.trim() ?? ""}
        />
      </div>
    </Container>
  );
}
