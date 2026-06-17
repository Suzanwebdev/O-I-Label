import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { CheckoutSuccessClient } from "@/components/checkout/checkout-success-client";
import { CheckoutSuccessSummary } from "@/components/checkout/checkout-success-summary";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { reconcileOrderPayment } from "@/lib/payments/reconcile-payment";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Order Confirmation",
  description: "Your O & I Label order confirmation.",
  path: "/checkout/success",
  noIndex: true,
});

type Props = { searchParams: Promise<{ demo?: string; payment?: string; order?: string }> };

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { demo, payment, order: orderId } = await searchParams;
  const isDemo = demo === "1";
  let paid = payment === "success";
  let state: "paid" | "failed" | "pending" = paid ? "paid" : "pending";
  let orderSummary: {
    order_number: string;
    total_ghs: number;
    email: string;
    items: Array<{ name: string; quantity: number; unit_price_ghs: number }>;
  } | null = null;

  if (!isDemo && orderId) {
    try {
      const reconciled = await reconcileOrderPayment(orderId);
      const service = createServiceRoleClient();
      const { data: paymentRow } = await service
        .from("payments")
        .select("status")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const status = typeof paymentRow?.status === "string" ? paymentRow.status : "";
      if (status === "paid" || (reconciled.ok && reconciled.paid)) {
        paid = true;
        state = "paid";
      } else if (status === "failed") {
        state = "failed";
      } else {
        state = "pending";
      }

      const { data: order } = await service
        .from("orders")
        .select(
          `
          order_number,
          total_ghs,
          email,
          order_items ( name, quantity, unit_price_ghs )
        `
        )
        .eq("id", orderId)
        .maybeSingle();

      if (order) {
        const items = (Array.isArray(order.order_items) ? order.order_items : []).map((row) => ({
          name: String(row.name ?? "Item"),
          quantity: Number(row.quantity ?? 1),
          unit_price_ghs: Number(row.unit_price_ghs ?? 0),
        }));
        orderSummary = {
          order_number: String(order.order_number),
          total_ghs: Number(order.total_ghs),
          email: String(order.email ?? ""),
          items,
        };
      }
    } catch {
      state = paid ? "paid" : "pending";
    }
  }

  const message = isDemo
    ? "This was a demo checkout. When live payments are connected, confirmation and tracking details will appear here."
    : state === "paid"
      ? "Payment received. We've sent your confirmation by email and SMS."
      : state === "failed"
        ? "Payment was not completed. Please return to checkout and try again."
        : "Your payment is still being confirmed. If you've already paid, this page will update shortly.";

  return (
    <div className="border-b border-border/60 bg-background py-14 md:py-20">
      <Container className="text-center">
        <CheckoutSuccessClient shouldClearSelected={isDemo || paid} />
        <h1 className="font-serif-display text-3xl font-semibold tracking-tight md:text-4xl">
          Thank you for your order
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground md:text-base">{message}</p>

        {orderSummary ? <CheckoutSuccessSummary order={orderSummary} /> : null}

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
