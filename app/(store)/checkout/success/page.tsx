import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { CheckoutSuccessClient } from "@/components/checkout/checkout-success-client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Order Confirmation",
  description: "Your O & I Label order confirmation.",
  path: "/checkout/success",
  noIndex: true,
});

type Props = { searchParams: Promise<{ demo?: string; payment?: string; order?: string }> };

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { demo, payment, order } = await searchParams;
  const isDemo = demo === "1";
  let paid = payment === "success";
  let state: "paid" | "failed" | "pending" = paid ? "paid" : "pending";

  if (!isDemo && order) {
    try {
      const service = createServiceRoleClient();
      const { data: paymentRow } = await service
        .from("payments")
        .select("status")
        .eq("order_id", order)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const status = typeof paymentRow?.status === "string" ? paymentRow.status : "";
      if (status === "paid") {
        paid = true;
        state = "paid";
      } else if (status === "failed") {
        state = "failed";
      } else {
        state = "pending";
      }
    } catch {
      state = paid ? "paid" : "pending";
    }
  }

  const message = isDemo
    ? "This was a demo checkout. When live payments are connected, confirmation and tracking details will appear here."
    : state === "paid"
      ? "Payment received. We've received your order and will send updates by email and SMS."
      : state === "failed"
        ? "Payment was not completed. Please return to checkout and try again."
        : "Your payment is still being confirmed. If you've already paid, this page will reflect it shortly.";

  return (
    <div className="border-b border-border/60 bg-background py-14 md:py-20">
      <Container className="text-center">
        <CheckoutSuccessClient shouldClearSelected={isDemo || paid} />
        <h1 className="font-serif-display text-3xl font-semibold tracking-tight md:text-4xl">
          Thank you for your order
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground md:text-base">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
          {state === "failed" ? (
            <Button asChild variant="outline">
              <Link href="/checkout">Try payment again</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/account/orders">View orders</Link>
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
}
