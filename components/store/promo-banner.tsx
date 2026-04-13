import Link from "next/link";
import { Container } from "@/components/store/container";
import { cn } from "@/lib/utils";

export function PromoBanner({
  title,
  subtitle,
  href,
  cta,
  className,
}: {
  title: string;
  subtitle?: string;
  href: string;
  cta: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-y border-border bg-navy text-primary-foreground",
        className
      )}
    >
      <Container className="flex flex-col items-start justify-between gap-4 py-8 md:flex-row md:items-center">
        <div className="max-w-xl space-y-2">
          <p className="font-serif-display text-2xl md:text-3xl">{title}</p>
          {subtitle ? (
            <p className="text-sm text-white/80 md:text-base">{subtitle}</p>
          ) : null}
        </div>
        <Link
          href={href}
          className="inline-flex h-11 shrink-0 items-center rounded-[var(--radius-md)] border border-white/30 bg-white px-6 text-sm font-medium text-navy transition-colors hover:bg-white/90"
        >
          {cta}
        </Link>
      </Container>
    </div>
  );
}
