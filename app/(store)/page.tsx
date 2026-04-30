import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { Container } from "@/components/store/container";
import { Section } from "@/components/store/section";
import { mockCategories } from "@/lib/mock-data";
import { listProducts } from "@/lib/data/catalog";
import { listCategoriesFromDb } from "@/lib/data/catalog";
import { filterProducts, sortProducts } from "@/lib/shop-utils";
import { BestSellersRow } from "@/components/home/best-sellers-row";
import { HomeHero } from "@/components/home/home-hero";
import { HOME_HERO_SLIDES } from "@/lib/home-hero-slides";
import {
  OccasionSection,
  type OccasionItem,
} from "@/components/home/occasion-section";

/** Local assets in /public/home ' boutique hero + category thumbnails (order matches mockCategories). */
const categoryImageBySlug: Record<string, string> = {
  tops: "/home/category-tops.png",
  dresses: "/home/category-dresses.png",
  "two-piece-sets": "/home/category-two-piece-sets.png",
  bottoms: "/home/category-bottoms.png",
  suits: "/home/category-suits.png",
  denim: "/home/category-denim.png",
  bodysuits: "/home/category-bodysuits.png",
  jumpsuits: "/home/category-jumpsuits.png",
  cardigans: "/home/category-cardigans.png",
  knitwear: "/home/category-knitwear.png",
  "new-arrivals": "/home/category-new-arrivals.png",
};

const occasionItems: OccasionItem[] = [
  {
    title: "Birthday",
    href: "/shop?occasion=birthday",
    image:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1260&h=1680&fit=crop&q=85",
    alt: "Birthday occasion - elevated dress moment",
  },
  {
    title: "Vacation",
    href: "/shop/dresses",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1260&h=1680&fit=crop&q=85",
    alt: "Vacation edit - resort-ready pieces",
  },
  {
    title: "Wedding",
    href: "/shop?tag=trending",
    image: "/home/occasion-wedding.png",
    alt: "Wedding occasion dressing",
    imageClassName: "object-cover object-[center_66%] scale-[1.08] group-hover:scale-[1.11]",
  },
  {
    title: "Corporate",
    href: "/shop?tag=best_seller",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1260&h=1680&fit=crop&q=85",
    alt: "Corporate and workwear occasion dressing",
  },
];

export default async function HomePage() {
  const [catalog, categories] = await Promise.all([listProducts(), listCategoriesFromDb()]);
  const categoriesToRender = categories.length ? categories : mockCategories;
  let bestSellers = filterProducts(catalog, { tag: "best_seller" }).filter(
    (p) => p.variants.length > 0
  );
  if (bestSellers.length < 6) {
    const ranked = sortProducts(
      catalog.filter((p) => p.variants.length > 0),
      "best_sellers"
    );
    const seen = new Set(bestSellers.map((p) => p.id));
    for (const p of ranked) {
      if (bestSellers.length >= 12) break;
      if (!seen.has(p.id)) {
        bestSellers.push(p);
        seen.add(p.id);
      }
    }
  }
  bestSellers = bestSellers.slice(0, 12);

  return (
    <>
      <Section className="px-0 !py-0 pb-0">
        <HomeHero slides={HOME_HERO_SLIDES}>
          <div className="flex h-[min(85svh,calc(100svh-5.5rem))] items-end px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-10 sm:h-[min(85svh,calc(100svh-6rem))] sm:px-5 sm:pb-8 sm:pt-12 md:h-auto md:min-h-[calc(100dvh-8rem)] md:px-8 md:pb-12 md:pt-0">
            <Container className="px-0 sm:px-6 lg:px-8">
              <div className="max-w-xl space-y-2.5 text-white sm:space-y-3 md:max-w-lg">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/80">
                  The O & I Label edit
                </p>
                <h1 className="text-balance font-serif-display text-[clamp(1.625rem,5.5vw,2rem)] leading-[1.08] tracking-[-0.02em] sm:text-[32px] md:text-[36px] md:leading-none">
                  Minimal. Elegant. Timeless.
                </h1>
                <p className="max-w-md text-pretty text-[11px] leading-relaxed text-white/88 sm:text-xs md:max-w-lg">
                  Premium essentials with a clean feminine silhouette and modern
                  editorial confidence.
                </p>
                <div className="grid grid-cols-2 gap-2.5 pt-1 sm:flex sm:flex-row sm:flex-wrap sm:gap-2">
                  <Link
                    href="/shop"
                    className="group inline-flex h-11 min-h-11 w-full items-center justify-center rounded-full bg-white px-4 text-[13px] font-semibold tracking-[0.01em] text-black shadow-[0_10px_28px_-14px_rgba(0,0,0,0.6)] ring-1 ring-white/85 transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_16px_34px_-16px_rgba(0,0,0,0.68)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 sm:h-10 sm:min-h-10 sm:w-auto sm:px-5 sm:text-[11px]"
                  >
                    Shop now
                  </Link>
                  <Link
                    href="/shop?tag=best_seller"
                    className="group inline-flex h-11 min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-white/55 bg-black/20 px-4 text-[13px] font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_12px_32px_-18px_rgba(0,0,0,0.72)] backdrop-blur-md transition-all duration-300 hover:-translate-y-[1px] hover:border-white/75 hover:bg-black/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 sm:h-10 sm:min-h-10 sm:w-auto sm:px-5 sm:text-[11px]"
                  >
                    <span>View lookbook</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-85 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </Container>
          </div>
        </HomeHero>
      </Section>

      <Section className="pt-5 pb-7 md:py-3">
        <Container>
          <div className="mb-4 flex items-center justify-between md:mb-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Shop by category
            </p>
            <Link href="/shop" className="text-xs text-navy hover:underline">
              Shop all
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-x-4 gap-y-6 pb-3 md:gap-y-5 md:pb-1">
            {categoriesToRender.map((c) => (
              <Link
                key={c.slug}
                href={`/shop/${c.slug}`}
                className="group flex min-w-0 flex-col items-center gap-2"
              >
                <div className="relative h-[76px] w-[76px] overflow-hidden rounded-full border border-border bg-muted md:h-[96px] md:w-[96px]">
                  <Image
                    src={
                      ("image_url" in c ? c.image_url : null) ??
                      categoryImageBySlug[c.slug] ??
                      `/home/category-tops.png`
                    }
                    alt={c.name}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-105"
                    sizes="96px"
                  />
                </div>
                <span className="text-center text-[13px] leading-tight text-foreground group-hover:text-navy md:text-[15px]">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <OccasionSection
        eyebrow="Shop by occasion"
        title="Clean pieces. Strong looks."
        ctaHref="/shop"
        ctaLabel="View lookbook"
        items={occasionItems}
        className="pt-7 pb-10 md:pt-6 md:pb-14"
      />

      <Section className="pt-4 pb-10 md:pt-6 md:pb-12">
        <Container>
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Best sellers
            </p>
            <Link
              href="/shop?tag=best_seller"
              className="inline-flex items-center gap-1 text-xs text-navy hover:underline"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <h2 className="mb-6 font-serif-display text-[28px] leading-tight md:text-[34px]">
            The pieces everyone wants.
          </h2>
          <div className="px-1 md:px-2">
            <BestSellersRow products={bestSellers} />
          </div>
        </Container>
      </Section>
    </>
  );
}

