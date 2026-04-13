import Link from "next/link";
import { cn } from "@/lib/utils";
import { Container } from "@/components/store/container";
import { Section } from "@/components/store/section";
import { OccasionCard } from "@/components/home/occasion-card";

export type OccasionItem = {
  title: string;
  image: string;
  href: string;
  alt?: string;
  imageClassName?: string;
};

type OccasionSectionProps = {
  items: OccasionItem[];
  eyebrow?: string;
  title: string;
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
};

export function OccasionSection({
  items,
  eyebrow = "Shop by occasion",
  title,
  ctaHref = "/shop",
  ctaLabel = "View lookbook",
  className,
}: OccasionSectionProps) {
  return (
    <Section className={cn("pt-3 pb-10 md:pt-6 md:pb-14", className)}>
      <Container>
        <div className="mb-6 flex items-end justify-between gap-6 md:mb-8">
          <div className="min-w-0 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="font-serif-display text-[32px] leading-[1.05] tracking-[-0.02em] text-foreground md:text-[40px] lg:text-[44px]">
              {title}
            </h2>
          </div>
          <Link
            href={ctaHref}
            className="hidden shrink-0 text-xs font-medium tracking-wide text-navy underline-offset-[5px] hover:underline sm:inline"
          >
            {ctaLabel}
          </Link>
        </div>

        <div
          className={cn(
            "flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3 pb-1",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "md:grid md:snap-none md:grid-cols-2 md:gap-2.5 md:overflow-visible md:scroll-p-0 md:pb-0",
            "lg:grid-cols-4 lg:gap-3",
            "-mx-4 px-4 md:mx-0 md:px-0"
          )}
        >
          {items.map((item) => (
            <OccasionCard
              key={`${item.href}-${item.title}`}
              image={item.image}
              title={item.title}
              href={item.href}
              alt={item.alt}
              imageClassName={item.imageClassName}
              className="min-w-[min(85vw,25.2rem)] shrink-0 snap-center sm:min-w-[min(81vw,30.6rem)] md:min-w-0"
            />
          ))}
        </div>

        <div className="mt-5 flex justify-center sm:hidden">
          <Link
            href={ctaHref}
            className="text-xs font-medium tracking-wide text-navy underline-offset-[5px] hover:underline"
          >
            {ctaLabel}
          </Link>
        </div>
      </Container>
    </Section>
  );
}
