import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";

export default function CheckoutReturnPage() {
  return (
    <Container className="py-24 text-center space-y-4">
      <p className="font-serif-display text-2xl">Payment return</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        After gateway redirect, the app verifies server-side and updates your
        order. If you are not redirected automatically, check your email or{" "}
        <Link href="/track-order" className="text-navy underline">
          track your order
        </Link>
        .
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </Container>
  );
}
