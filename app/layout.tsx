import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistProvider } from "@/components/providers/wishlist-provider";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope-next",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant-next",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_BASE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "O & I Label — Elevated essentials",
    template: "%s · O & I Label",
  },
  description:
    "Women's fashion and elevated essentials. Modern pieces designed to flatter and stand out.",
  openGraph: {
    type: "website",
    locale: "en_GH",
    siteName: "O & I Label",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${manrope.variable} ${cormorantGaramond.variable}`}>
      <body className="min-h-full flex flex-col font-sans">
        <WishlistProvider>
          <CartProvider>{children}</CartProvider>
        </WishlistProvider>
      </body>
    </html>
  );
}
