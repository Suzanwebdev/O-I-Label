import { DEFAULT_FOOTER } from "@/lib/home/homepage-cms";
import { getSiteUrl } from "@/lib/seo/site";

export const EMAIL_BRAND = {
  name: "O & I Label",
  tagline: "Minimal. Elegant. Timeless.",
  siteUrl: getSiteUrl(),
  colors: {
    bg: "#f7f5f2",
    card: "#ffffff",
    text: "#1a1a1a",
    textMuted: "#6d6560",
    border: "#e8e2da",
    accent: "#9a8b7a",
    ctaBg: "#1a1a1a",
    ctaText: "#ffffff",
    bgDark: "#121212",
    cardDark: "#1c1c1c",
    textDark: "#f5f2ef",
    textMutedDark: "#b8b0a8",
    borderDark: "#3a3632",
  },
} as const;

export function emailSupportAddress(): string {
  const explicit = process.env.SUPPORT_EMAIL?.trim() || process.env.CONTACT_EMAIL?.trim();
  if (explicit) return explicit;
  const from = process.env.EMAIL_FROM?.trim();
  if (from && from.includes("@")) {
    const match = from.match(/<([^>]+)>/);
    return match?.[1] ?? from;
  }
  return "hello@oandilabel.com";
}

export function emailInstagramUrl(): string {
  const social = DEFAULT_FOOTER.social.find((s) => s.label.toLowerCase().includes("instagram"));
  return social?.href ?? "https://www.instagram.com/outfitsideas_gh";
}

export function emailFooterLinks() {
  const base = EMAIL_BRAND.siteUrl;
  return {
    contact: `${base}/contact`,
    trackOrder: `${base}/track-order`,
    returns: `${base}/policies/returns`,
    shipping: `${base}/policies/shipping`,
    shop: `${base}/shop`,
    instagram: emailInstagramUrl(),
    supportEmail: emailSupportAddress(),
  };
}
