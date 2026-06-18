import type { Metadata } from "next";
import {
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  SITE_LOCALE,
  SITE_NAME,
  absoluteUrl,
  toAbsoluteImageUrl,
} from "./site";

type BuildPageMetadataInput = {
  /** Page title without brand suffix (template adds `| O & I Label`). Use `absolute` for full control. */
  title: string | { absolute: string };
  description: string;
  path: string;
  keywords?: string[];
  ogImage?: string | null;
  ogType?: "website" | "article";
  noIndex?: boolean;
};

export function buildPageMetadata(input: BuildPageMetadataInput): Metadata {
  const canonical = absoluteUrl(input.path);
  const titleString =
    typeof input.title === "string" ? input.title : input.title.absolute;

  const ogImage = input.ogImage
    ? toAbsoluteImageUrl(input.ogImage)
    : toAbsoluteImageUrl(DEFAULT_OG_IMAGE);

  const keywords = [...new Set([...(input.keywords ?? []), ...DEFAULT_KEYWORDS])].slice(0, 24);

  const robots = input.noIndex
    ? { index: false as const, follow: false as const }
    : { index: true as const, follow: true as const };

  return {
    title: typeof input.title === "string" ? input.title : { absolute: input.title.absolute },
    description: input.description,
    keywords,
    alternates: { canonical },
    robots,
    openGraph: {
      title: titleString,
      description: input.description,
      url: canonical,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: input.ogType ?? "website",
      images: [{ url: ogImage, alt: titleString }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleString,
      description: input.description,
      images: [ogImage],
    },
  };
}

export const homeMetadata: Metadata = buildHomeMetadata();

export function buildHomeMetadata(ogImage?: string | null): Metadata {
  return buildPageMetadata({
    title: { absolute: "O & I Label | Premium Women's Fashion" },
    description:
      "Shop premium women's fashion, dresses, two-piece sets, and statement looks at O & I Label.",
    path: "/",
    keywords: [
      "premium women's fashion",
      "women's fashion Ghana",
      "luxury dresses online",
      "two-piece sets",
      "fashion e-commerce",
    ],
    ogImage: ogImage ?? DEFAULT_OG_IMAGE,
  });
}

export const shopMetadata: Metadata = buildPageMetadata({
  title: "Shop Women's Fashion",
  description:
    "Browse premium women's fashion at O & I Label — dresses, two-piece sets, tops, and new arrivals with elevated feminine style.",
  path: "/shop",
});

export function privatePageMetadata(title: string, path: string): Metadata {
  return buildPageMetadata({
    title,
    description: `${title} — O & I Label account area.`,
    path,
    noIndex: true,
  });
}
