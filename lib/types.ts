export type ProductBadge =
  | "new"
  | "best_seller"
  | "limited"
  | "sale"
  | "selling_fast"
  | "trending";

export type OccasionTag = "birthday" | "vacation" | "wedding" | "corporate";

export interface ProductVariant {
  id: string;
  size?: string;
  color?: string;
  sku: string;
  price_ghs: number;
  compare_at_ghs?: number;
  stock: number;
  image_url?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category_slug: string;
  category_name: string;
  images: string[];
  badges: ProductBadge[];
  occasions?: OccasionTag[];
  rating?: number;
  review_count?: number;
  variants: ProductVariant[];
  is_active: boolean;
}

export interface Category {
  slug: string;
  name: string;
  description?: string;
}

export interface CartLine {
  variantId: string;
  productId: string;
  productSlug: string;
  name: string;
  image: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPriceGhs: number;
}

export type AdminRole = "superadmin" | "admin" | "staff" | "customer";

export interface FeatureFlags {
  reviews: boolean;
  loyalty: boolean;
  referrals: boolean;
  bundles_bogo: boolean;
  abandoned_cart: boolean;
  store_credit: boolean;
  subscriptions: boolean;
  staff_chat: boolean;
  advanced_analytics: boolean;
  instagram_shop: boolean;
}
