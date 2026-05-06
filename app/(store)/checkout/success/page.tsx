import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";

type Props = { searchParams: Promise<{ demo?: string }> };

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { demo } = await searchParams;
  const isDemo = demo === "1";

  return (
    <div className="border-b border-border/60 bg-background py-14 md:py-20">
      <Container className="text-center">
        <h1 className="font-serif-display text-3xl font-semibold tracking-tight md:text-4xl">
          Thank you for your order
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground md:text-base">
          {isDemo
            ? "This was a demo checkout. When live payments are connected, confirmation and tracking details will appear here."
            : "We've received your order. You'll get a confirmation email shortly."}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account/orders">View orders</Link>
          </Button>
        </div>
      </Container>
    </div>
  );
}
