import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/store/heading";

export default function CheckoutSuccessPage() {
  return (
    <Container className="py-20 text-center">
      <Heading as="h1" eyebrow="Thank you">
        Your order is confirmed
      </Heading>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">
        A confirmation email will be sent from Resend once payments are live.
        For support, reach us on WhatsApp — never for payment.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/shop">Continue shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/track-order">Track order</Link>
        </Button>
      </div>
    </Container>
  );
}
