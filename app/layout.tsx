import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistProvider } from "@/components/providers/wishlist-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/json-ld";
import { DEFAULT_KEYWORDS, SITE_LOCALE, SITE_NAME, getSiteUrl } from "@/lib/seo/site";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope-next",
  preload: true,
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
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
