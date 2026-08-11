import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/store/container";
import { Section } from "@/components/store/section";
import { StarRating } from "@/components/reviews/star-rating";
import { listFeaturedPublishedReviews } from "@/lib/reviews/queries";
import { isReviewsFeatureEnabled } from "@/lib/reviews/feature";

export async function HomeLovedBySection() {
  if (!(await isReviewsFeatureEnabled())) return null;

  const reviews = await listFeaturedPublishedReviews(6);
  if (!reviews.length) return null;

  return (
    <Section className="border-t border-border/60 bg-background pt-10 pb-12 md:pt-12 md:pb-16">
      <Container>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Loved by our customers
        </p>
        <h2 className="mt-2 font-serif-display text-[28px] leading-tight md:text-[34px]">
          What clients say
        </h2>

        <div className="mt-8 flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
          {reviews.map((r) => (
            <article
              key={r.id}
              className="min-w-[78%] shrink-0 rounded-[var(--radius-lg)] border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:min-w-[320px] md:min-w-0"
            >
              <StarRating value={r.rating} size="sm" />
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                “{(r.body || r.title || "Beautiful piece.").slice(0, 160)}
                {(r.body || r.title || "").length > 160 ? "…" : ""}”
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">{r.display_name}</p>
                  {r.verified_purchase ? (
                    <p className="text-[11px] text-emerald-800">✓ Verified Purchase</p>
                  ) : null}
                </div>
                {r.product_slug ? (
                  <Link
                    href={`/product/${r.product_slug}`}
                    className="text-[11px] uppercase tracking-[0.14em] text-navy hover:underline"
                  >
                    Shop
                  </Link>
                ) : null}
              </div>
              {r.media[0] ? (
                <div className="relative mt-4 aspect-[4/5] w-full overflow-hidden rounded-md border border-border bg-muted">
                  <Image
                    src={r.media[0].public_url}
                    alt="Customer photo"
                    fill
                    className="object-cover"
                    sizes="320px"
                    unoptimized
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
