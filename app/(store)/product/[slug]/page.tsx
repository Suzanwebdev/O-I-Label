import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getProductBySlugFromDb } from "@/lib/data/catalog";
import { toStorefrontProduct, toStorefrontProducts } from "@/lib/catalog/storefront-product";
import { Container } from "@/components/store/container";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductVariantForm } from "@/components/product/product-variant-form";
import { BadgeSet } from "@/components/store/badge-set";
import { JsonLd } from "@/components/seo/json-ld";
import { buildProductDescription, buildProductSeoTitle } from "@/lib/seo/descriptions";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getRelatedProducts } from "@/lib/data/related-products";
import { ProductYouMayAlsoLike } from "@/components/product/product-you-may-also-like";
import { ProductReviewsSection } from "@/components/reviews/product-reviews-section";
import { ProductReviewComposer } from "@/components/reviews/product-review-composer";
import { StarRating } from "@/components/reviews/star-rating";
import {
  getPublishedReviewAggregates,
  listPublishedReviews,
} from "@/lib/reviews/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlugFromDb(decodeURIComponent(slug));
  if (!product) {
    return buildPageMetadata({
      title: "Product Not Found",
      description:
        "This product is unavailable at O & I Label. Browse premium women's fashion in our shop.",
      path: `/product/${slug}`,
    });
  }

  return buildPageMetadata({
    title: buildProductSeoTitle(product),
    description: buildProductDescription(product),
    path: `/product/${product.slug}`,
    ogImage: product.images[0] ?? null,
    keywords: [product.name, product.category_name, "women's fashion", "premium fashion"],
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlugFromDb(decodeURIComponent(slug));

  if (!product || product.variants.length === 0) {
    notFound();
  }

  const relatedProducts = toStorefrontProducts(await getRelatedProducts(product, 10));
  const storefrontProduct = toStorefrontProduct(product);
  const productPath = `/product/${product.slug}`;

  const supabase = await createServerSupabaseClient();
  const [aggregates, listed, userResult] = await Promise.all([
    getPublishedReviewAggregates(product.id),
    listPublishedReviews({ productId: product.id, page: 1, pageSize: 8, sort: "newest" }),
    supabase.auth.getUser(),
  ]);

  const user = userResult.data.user;
  const displayName =
    (typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    "O & I Customer";

  const publicRating =
    aggregates.count > 0 && aggregates.average != null
      ? { rating: aggregates.average, review_count: aggregates.count }
      : { rating: null as number | null, review_count: 0 };

  const productForSeo = {
    ...product,
    rating: publicRating.rating ?? undefined,
    review_count: publicRating.review_count,
  };

  return (
    <article className="border-border/60 border-b bg-background py-8 md:py-12">
      <JsonLd
        data={[
          productJsonLd(productForSeo, productPath, listed.reviews),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: product.category_name, path: `/shop/${product.category_slug}` },
            { name: product.name, path: productPath },
          ]),
        ]}
      />
      <Container className="px-4 sm:px-6 lg:px-8">
        <nav
          className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground md:mb-8"
          aria-label="Breadcrumb"
        >
          <Link href="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
          <Link href={`/shop/${product.category_slug}`} className="hover:text-foreground">
            {product.category_name}
          </Link>
          <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
          <span className="text-foreground" aria-current="page">
            {product.name}
          </span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-12 lg:items-start">
          <ProductGallery
            productKey={product.id}
            productSlug={product.slug}
            images={product.images}
            name={product.name}
          />
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
              {publicRating.rating != null && publicRating.review_count > 0 ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <StarRating value={publicRating.rating} size="sm" />
                  <span>
                    {publicRating.rating.toFixed(1)} · {publicRating.review_count} review
                    {publicRating.review_count === 1 ? "" : "s"}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Be the first to review this piece.</p>
              )}
              <div className="mt-4">
                <BadgeSet badges={product.badges} />
              </div>
              <div className="mt-5 border-t border-border pt-5">
                <ProductVariantForm product={storefrontProduct} />
              </div>
            </div>
          </aside>
        </div>

        <ProductReviewsSection
          productId={product.id}
          initialAggregates={aggregates}
          initialReviews={listed.reviews}
          initialTotal={listed.total}
        />

        <ProductReviewComposer
          productId={product.id}
          productSlug={product.slug}
          isSignedIn={Boolean(user)}
          defaultDisplayName={displayName}
        />

        <ProductYouMayAlsoLike products={relatedProducts} />
      </Container>
    </article>
  );
}
