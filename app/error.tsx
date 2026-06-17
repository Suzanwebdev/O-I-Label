"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront-error]", error);
  }, [error]);

  return (
    <div className="border-b border-border/60 bg-background py-20 md:py-28">
      <Container className="text-center">
        <h1 className="font-serif-display text-3xl tracking-tight md:text-4xl">Something went wrong</h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
          We couldn&apos;t load this page. Please try again or return to the shop.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop">Shop collection</Link>
          </Button>
        </div>
      </Container>
    </div>
  );
}
