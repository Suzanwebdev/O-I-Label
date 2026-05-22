import { getHomepageCmsAdmin } from "@/lib/data/homepage-cms";
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

/** Canonical business profile — matches homepage CMS default. */
export const DEFAULT_INSTAGRAM_URL = "https://www.instagram.com/o_and_i_label/";

export type EmailFooterLinks = {
  contact: string;
  trackOrder: string;
  returns: string;
  shipping: string;
  shop: string;
  instagram: string;
  supportEmail: string;
};

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

/** Strip QR/utm params so Gmail and Outlook open the profile reliably. */
export function normalizeInstagramUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_INSTAGRAM_URL;

  try {
    const u = new URL(trimmed);
    if (!u.hostname.replace(/^www\./, "").includes("instagram.com")) {
      return trimmed;
    }
    const segments = u.pathname.split("/").filter(Boolean);
    const username = segments[0] || "o_and_i_label";
    return `https://www.instagram.com/${username}/`;
  } catch {
    const handle = trimmed
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .split(/[?#/]/)[0]
      .trim();
    return `https://www.instagram.com/${handle || "o_and_i_label"}/`;
  }
}

function instagramFromDefaults(): string {
  const social = DEFAULT_FOOTER.social.find((s) => s.label.toLowerCase().includes("instagram"));
  return normalizeInstagramUrl(social?.href ?? DEFAULT_INSTAGRAM_URL);
}

function instagramFromEnv(): string | null {
  const raw =
    process.env.INSTAGRAM_URL?.trim() ||
    process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() ||
    null;
  return raw ? normalizeInstagramUrl(raw) : null;
}

/** Same source as the live site footer (homepage CMS), with env override. */
export async function getEmailFooterLinks(): Promise<EmailFooterLinks> {
  const base = EMAIL_BRAND.siteUrl;
  let instagram = instagramFromEnv();

  if (!instagram) {
    try {
      const cms = await getHomepageCmsAdmin();
      const entry = cms.footer.social.find((s) => s.label.toLowerCase().includes("instagram"));
      if (entry?.href?.trim()) {
        instagram = normalizeInstagramUrl(entry.href);
      }
    } catch (e) {
      console.warn("Email footer: could not load homepage CMS social links", e);
    }
  }

  if (!instagram) {
    instagram = instagramFromDefaults();
  }

  return {
    contact: `${base}/contact`,
    trackOrder: `${base}/track-order`,
    returns: `${base}/policies/returns`,
    shipping: `${base}/policies/shipping`,
    shop: `${base}/shop`,
    instagram,
    supportEmail: emailSupportAddress(),
  };
}

/** @deprecated Use getEmailFooterLinks() so emails match live CMS. */
export function emailFooterLinks(): EmailFooterLinks {
  const base = EMAIL_BRAND.siteUrl;
  return {
    contact: `${base}/contact`,
    trackOrder: `${base}/track-order`,
    returns: `${base}/policies/returns`,
    shipping: `${base}/policies/shipping`,
    shop: `${base}/shop`,
    instagram: instagramFromEnv() ?? instagramFromDefaults(),
    supportEmail: emailSupportAddress(),
  };
}
