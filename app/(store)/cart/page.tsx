import Link from "next/link";
import { Container } from "@/components/store/container";
import { CartPageClient } from "@/components/store/cart-page-client";

export default function CartPage() {
  return (
    <div className="border-b border-border/60 bg-background py-10 md:py-12">
      <Container>
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-serif-display text-3xl font-semibold tracking-tight">Your bag</h1>
          <Link href="/shop" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Continue shopping
          </Link>
        </div>
        <CartPageClient />
      </Container>
    </div>
  );
}
