/** Curated mobile drawer navigation — categories omitted here remain on /shop and category URLs. */

export type MobileNavLink = { href: string; label: string };

export type MobileNavSection = {
  id: string;
  label: string;
  links: MobileNavLink[];
};

export const MOBILE_STORE_NAV: MobileNavSection[] = [
  {
    id: "new",
    label: "New",
    links: [
      { href: "/shop?tag=new", label: "New Arrivals" },
      { href: "/shop?tag=best_seller", label: "Best Sellers" },
    ],
  },
  {
    id: "shop",
    label: "Shop",
    links: [
      { href: "/shop/dresses", label: "Dresses" },
      { href: "/shop/two-piece-sets", label: "Two-Piece Sets" },
      { href: "/shop/tops", label: "Tops" },
      { href: "/shop/bottoms", label: "Bottoms" },
    ],
  },
  {
    id: "discover",
    label: "Discover",
    links: [
      { href: "/shop", label: "Shop All" },
      { href: "/shop?tag=sale", label: "Sale" },
    ],
  },
  {
    id: "occasion",
    label: "Shop by occasion",
    links: [
      { href: "/shop?occasion=birthday", label: "Birthday Collection" },
      { href: "/shop?occasion=vacation", label: "Vacation Collection" },
      { href: "/shop?occasion=wedding", label: "Wedding Collection" },
      { href: "/shop?occasion=corporate", label: "Corporate Collection" },
    ],
  },
  {
    id: "support",
    label: "Support",
    links: [
      { href: "/track-order", label: "Track Order" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
];

/** Public storefront route for the optional editorial CTA — hide block when null. */
export const MOBILE_NAV_EDITORIAL_CTA: { href: string; title: string; body: string; cta: string } | null =
  null;
