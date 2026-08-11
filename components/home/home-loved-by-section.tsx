import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/store/container";
import { Section } from "@/components/store/section";
import { StarRating } from "@/components/reviews/star-rating";
import { listFeaturedPublishedReviews } from "@/lib/reviews/queries";
import { isReviewsFeatureEnabled } from "@/lib/reviews/feature";
import { cn } from "@/lib/utils";

export async function HomeLovedBySection() {
  if (!(await isReviewsFeatureEnabled())) return null;

  const reviews = await listFeaturedPublishedReviews(6);
  if (!reviews.length) return null;

  const single = reviews.length === 1;

  return (
    <Section className="border-t border-border/60 bg-background pt-10 pb-11 md:pt-12 md:pb-14">
      <Container>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Loved by our customers
        </p>
        <h2 className="mt-2 font-serif-display text-[28px] leading-tight tracking-tight md:text-[34px]">
          What clients say
        </h2>

        <div
          className={cn(
            "mt-7 flex gap-3.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            single
              ? "md:overflow-visible"
              : "md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:pb-0 lg:grid-cols-3"
          )}
        >
          {reviews.map((r) => {
            const text = (r.body || r.title || "").trim();
            const excerpt =
              text.length > 180 ? `${text.slice(0, 180).trimEnd()}…` : text;

            return (
              <article
                key={r.id}
                className={cn(
                  "flex shrink-0 flex-col border border-border/80 bg-background px-4 py-4",
                  "rounded-[var(--radius-md)]",
                  single
                    ? "w-full md:max-w-sm"
                    : "w-full min-w-full md:min-w-0 md:w-auto"
                )}
              >
                <StarRating value={r.rating} size="sm" />

                {excerpt ? (
                  <p className="mt-3 text-[15px] leading-[1.6] text-foreground/90">
                    {excerpt}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{r.display_name}</span>
                  {r.verified_purchase ? (
                    <>
                      <span aria-hidden className="text-border">
                        ·
                      </span>
                      <span className="text-emerald-800/85">✓ Verified Purchase</span>
                    </>
                  ) : null}
                </div>

                {r.product_slug ? (
                  <Link
                    href={`/product/${r.product_slug}`}
                    className="mt-3 inline-flex w-fit items-center text-sm text-navy transition-colors hover:text-foreground"
                  >
                    Shop this piece
                    <span aria-hidden className="ml-1.5">
                      →
                    </span>
                  </Link>
                ) : null}

                {r.media[0] ? (
                  <div className="relative mt-3 aspect-[4/5] max-h-40 w-full max-w-[8.5rem] overflow-hidden rounded-[var(--radius-sm)] border border-border/70 bg-muted">
                    <Image
                      src={r.media[0].public_url}
                      alt="Customer photo"
                      fill
                      className="object-cover"
                      sizes="140px"
                      unoptimized
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
