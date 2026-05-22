import Link from "next/link";
import { Container } from "@/components/store/container";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Our Story",
  description:
    "O & I Label — premium women's fashion with a minimal, elegant, and timeless point of view. Based in Ghana.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="border-b border-border/60 bg-background py-10 md:py-14">
      <Container className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">About</p>
        <h1 className="mt-2 font-serif-display text-3xl font-semibold tracking-tight md:text-4xl">
          Our story
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
          <p>
            O &amp; I Label is a premium women&apos;s fashion brand built around clean silhouettes,
            elevated fabrics, and an editorial point of view — minimal, elegant, and timeless.
          </p>
          <p>
            Every piece is chosen to flatter, move with you, and stay relevant beyond a single season.
            We serve shoppers in Ghana and beyond with thoughtful design and reliable fulfilment.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/shop"
            className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
          >
            Shop the collection
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium"
          >
            Contact us
          </Link>
        </div>
      </Container>
    </div>
  );
}
