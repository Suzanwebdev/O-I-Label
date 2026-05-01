import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getProductBySlugFromDb } from "@/lib/data/catalog";
import { Container } from "@/components/store/container";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductVariantForm } from "@/components/product/product-variant-form";
import { BadgeSet } from "@/components/store/badge-set";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlugFromDb(decodeURIComponent(slug));
  if (!product) return { title: "Product" };
  return {
    title: product.name,
    description: product.description.slice(0, 160) || `${product.name} · O & I Label`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlugFromDb(decodeURIComponent(slug));

  if (!product || product.variants.length === 0) {
    notFound();
  }

  return (
    <div className="border-border/60 border-b bg-background py-8 pb-24 md:py-12 md:pb-12">
      <Container className="px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground md:mb-8">
          <Link href="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
          <Link href={`/shop/${product.category_slug}`} className="hover:text-foreground">
            {product.category_name}
          </Link>
          <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-12 lg:items-start">
          <ProductGallery images={product.images} name={product.name} />
          <aside className="space-y-6 lg:sticky lg:top-24">
            <div className="rounded-[var(--radius-lg)] border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6">
              <Link
                href={`/shop/${product.category_slug}`}
                className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-navy"
              >
                {product.category_name}
              </Link>
              <h1 className="mt-2 font-serif-display text-3xl font-semibold tracking-tight text-foreground md:text-[2.125rem]">
                {product.name}
              </h1>
              {product.rating != null ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {product.rating.toFixed(1)} rating
                  {product.review_count != null ? ` · ${product.review_count} reviews` : null}
                </p>
              ) : null}
              <div className="mt-4">
                <BadgeSet badges={product.badges} />
              </div>
              <div className="mt-5 border-t border-border pt-5">
                <ProductVariantForm product={product} />
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}
