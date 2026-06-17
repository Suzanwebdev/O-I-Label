import Link from "next/link";
import { Container } from "@/components/store/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="border-b border-border/60 bg-background py-20 md:py-28">
      <Container className="text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="mt-3 font-serif-display text-4xl tracking-tight md:text-5xl">Page not found</h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
          The page you&apos;re looking for may have moved or no longer exists.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop">Shop collection</Link>
          </Button>
        </div>
      </Container>
    </div>
  );
}
