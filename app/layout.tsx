import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistProvider } from "@/components/providers/wishlist-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/json-ld";
import { DEFAULT_KEYWORDS, SITE_LOCALE, SITE_NAME, getSiteUrl } from "@/lib/seo/site";

/** Self-hosted so CI/production builds do not depend on fonts.googleapis.com at build time. */
const manrope = localFont({
  src: "./fonts/manrope-normal-200800.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-manrope-next",
  preload: true,
});

const cormorantGaramond = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-normal-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond-normal-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-normal-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond-normal-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/cormorant-garamond-italic-400.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond-italic-500.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond-italic-600.woff2", weight: "600", style: "italic" },
    { path: "./fonts/cormorant-garamond-italic-700.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-cormorant-next",
  preload: true,
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "O & I Label | Premium Women's Fashion",
    template: "%s | O & I Label",
  },
  description:
    "Shop premium women's fashion, dresses, two-piece sets, and statement looks at O & I Label.",
  keywords: [...DEFAULT_KEYWORDS],
  applicationName: SITE_NAME,
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    url: siteUrl,
    title: "O & I Label | Premium Women's Fashion",
    description:
      "Shop premium women's fashion, dresses, two-piece sets, and statement looks at O & I Label.",
  },
  twitter: {
    card: "summary_large_image",
    title: "O & I Label | Premium Women's Fashion",
    description:
      "Shop premium women's fashion, dresses, two-piece sets, and statement looks at O & I Label.",
  },
  category: "fashion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  return (
    <html lang="en" className={`h-full antialiased ${manrope.variable} ${cormorantGaramond.variable}`}>
      <head>
        {supabaseOrigin ? <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" /> : null}
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
        <WishlistProvider>
          <CartProvider>{children}</CartProvider>
        </WishlistProvider>
      </body>
    </html>
  );
}
