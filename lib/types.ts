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
  /** When set in admin, used for `<title>` / Open Graph instead of `name` alone. */
  seo_title?: string | null;
  /** When set in admin, used for meta description / OG description instead of trimming `description`. */
  seo_description?: string | null;
  category_slug: string;
  category_name: string;
  images: string[];
  badges: ProductBadge[];
  /** Optional PDP bullets under "Why you'll love it"; empty hides the block. */
  love_it_points?: string[];
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
  /** When false, line stays in the bag but is excluded from subtotal and checkout until re-selected. */
  selected?: boolean;
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
