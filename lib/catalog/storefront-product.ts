import type { Product, ProductBadge, ProductVariant } from "@/lib/types";

/** Customer-facing variant — availability flag only, no inventory counts. */
export type StorefrontProductVariant = Omit<ProductVariant, "stock"> & {
  in_stock: boolean;
};

export type StorefrontProduct = Omit<Product, "variants"> & {
  variants: StorefrontProductVariant[];
};

export function isVariantInStock(
  variant: Pick<StorefrontProductVariant, "in_stock"> | Pick<ProductVariant, "stock">
): boolean {
  if ("in_stock" in variant && typeof variant.in_stock === "boolean") {
    return variant.in_stock;
  }
  return Number((variant as ProductVariant).stock ?? 0) > 0;
}

export function toStorefrontProduct(product: Product): StorefrontProduct {
  return {
    ...product,
    variants: product.variants.map((variant) => {
      const { stock, ...rest } = variant;
      return { ...rest, in_stock: stock > 0 };
    }),
  };
}

export function toStorefrontProducts(products: Product[]): StorefrontProduct[] {
  return products.map(toStorefrontProduct);
}

/** Product fields no listing reads (product page only), so they are not sent to listing pages. */
const LISTING_OMITTED_FIELDS = ["seo_title", "seo_description", "love_it_points", "review_count"] as const;
type ListingOmittedField = (typeof LISTING_OMITTED_FIELDS)[number];

export type StorefrontListingVariant = Omit<StorefrontProductVariant, "sku">;

/**
 * Card / listing shape for homepage best sellers, shop, category and related
 * products: first image only, no product-page-only fields, no variant SKUs.
 * Search, filters, sorting, quick view, add-to-bag and restock still have every field they read.
 */
export type StorefrontListingProduct = Omit<StorefrontProduct, ListingOmittedField | "variants"> & {
  variants: StorefrontListingVariant[];
};

/** Expects products that already carry the live-stock overlay. */
export function toStorefrontListingProduct(product: Product): StorefrontListingProduct {
  const listing: Partial<StorefrontProduct> = toStorefrontProduct(product);
  for (const field of LISTING_OMITTED_FIELDS) delete listing[field];
  const variants = (listing.variants ?? []).map((variant) => {
    const listingVariant: Partial<StorefrontProductVariant> = { ...variant };
    delete listingVariant.sku;
    return listingVariant as StorefrontListingVariant;
  });
  return {
    ...(listing as Omit<StorefrontProduct, ListingOmittedField | "variants">),
    images: product.images.slice(0, 1),
    variants,
  };
}

export function toStorefrontListingProducts(products: Product[]): StorefrontListingProduct[] {
  return products.map(toStorefrontListingProduct);
}

/** Prefer the first in-stock variant for cards and quick add. */
export function primaryStorefrontVariant<V extends StorefrontListingVariant>(product: { variants: V[] }): V {
  return product.variants.find((v) => v.in_stock) ?? product.variants[0];
}

export function isStorefrontProductInStock(
  product: Pick<StorefrontListingProduct, "variants">
): boolean {
  return product.variants.some((v) => v.in_stock);
}

/**
 * Listing/card badges only. Fully sold-out products hide promotional tags
 * (Best Seller, Trending, etc.) so only the Sold Out badge is shown.
 * Does not mutate product.badges — PDP should keep using product.badges directly.
 */
export function listingBadgesForStorefrontProduct(
  product: Pick<StorefrontListingProduct, "badges" | "variants">
): ProductBadge[] {
  if (!isStorefrontProductInStock(product)) return [];
  return product.badges ?? [];
}
