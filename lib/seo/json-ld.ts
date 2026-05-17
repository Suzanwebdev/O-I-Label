import type { Product } from "@/lib/types";
import { buildProductDescription } from "./descriptions";
import { SITE_NAME, absoluteUrl, getSiteUrl, toAbsoluteImageUrl } from "./site";

export function organizationJsonLd() {
  const url = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url,
    logo: toAbsoluteImageUrl("/file.svg"),
    sameAs: [] as string[],
  };
}

export function webSiteJsonLd() {
  const url = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function productJsonLd(product: Product, productPath: string) {
  const url = absoluteUrl(productPath);
  const prices = product.variants.map((v) => v.price_ghs);
  const minPrice = prices.length ? Math.min(...prices) : undefined;
  const maxPrice = prices.length ? Math.max(...prices) : undefined;
  const inStock = product.variants.some((v) => v.stock > 0);
  const primaryVariant = product.variants.reduce((a, b) =>
    a.price_ghs <= b.price_ghs ? a : b
  );
  const images = product.images
    .filter(Boolean)
    .map((src) => toAbsoluteImageUrl(src))
    .slice(0, 8);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: buildProductDescription(product),
    image: images.length ? images : undefined,
    sku: primaryVariant.sku,
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    category: product.category_name,
    offers: {
      "@type": "AggregateOffer",
      url,
      priceCurrency: "GHS",
      lowPrice: minPrice?.toFixed(2),
      highPrice: maxPrice?.toFixed(2),
      offerCount: product.variants.length,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      offers: product.variants.map((v) => ({
        "@type": "Offer",
        sku: v.sku,
        price: v.price_ghs.toFixed(2),
        priceCurrency: "GHS",
        availability:
          v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url,
      })),
    },
    ...(product.rating != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: Math.max(1, product.review_count ?? 1),
          },
        }
      : {}),
  };
}

export function collectionPageJsonLd(category: {
  name: string;
  slug: string;
  description?: string | null;
}) {
  const path = `/shop/${category.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} | ${SITE_NAME}`,
    description: category.description ?? undefined,
    url: absoluteUrl(path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
  };
}
