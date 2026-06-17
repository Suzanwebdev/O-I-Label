import type { Product, ProductVariant } from "@/lib/types";

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

/** Prefer the first in-stock variant for cards and quick add. */
export function primaryStorefrontVariant(product: StorefrontProduct): StorefrontProductVariant {
  return product.variants.find((v) => v.in_stock) ?? product.variants[0];
}

export function isStorefrontProductInStock(product: StorefrontProduct): boolean {
  return product.variants.some((v) => v.in_stock);
}