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
    <div className="border-border/60 border-b bg-background py-10 md:py-14">
      <Container className="px-4 sm:px-6 lg:px-8">
        <nav className="mb-8 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
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

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-14 lg:items-start">
          <ProductGallery images={product.images} name={product.name} />
          <div className="space-y-5">
            <div>
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
            </div>
            <BadgeSet badges={product.badges} />
            {product.description ? (
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <p className="whitespace-pre-line leading-relaxed">{product.description}</p>
              </div>
            ) : null}
            <ProductVariantForm product={product} />
          </div>
        </div>
      </Container>
    </div>
  );
}
