import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/store/container";
import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import { buildPageMetadata } from "@/lib/seo/metadata";

const POLICY_CONTENT: Record<string, { title: string; description: string; sections: string[] }> = {
  shipping: {
    title: "Shipping & Delivery",
    description:
      "O & I Label shipping and delivery policy for premium women's fashion orders in Ghana and beyond.",
    sections: [
      "Orders are processed after payment confirmation. Delivery timelines vary by location and are shared at checkout or by support.",
      "Please ensure your phone number and delivery details are accurate to avoid delays.",
      "For urgent delivery support, contact us on WhatsApp with your order number.",
    ],
  },
  returns: {
    title: "Returns & Exchanges",
    description:
      "Learn about returns and exchanges for O & I Label orders. Premium women's fashion with clear return guidance.",
    sections: [
      "Eligible items may be returned within the window stated at purchase, in unworn condition with tags attached.",
      "Contact support with your order number before sending items back so we can authorize your return.",
      "Refunds are processed to the original payment method once the return is inspected and approved.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    description: "How O & I Label collects, uses, and protects your personal information.",
    sections: [
      "We collect only the information required to process orders, support customers, and improve your shopping experience.",
      "Your data is handled securely and never sold to third parties.",
      "We use cookies and similar technologies as described in our Cookie Policy. You can manage optional Analytics (Google Analytics 4) and Marketing (Meta Pixel) preferences anytime via Cookie Settings on the Cookie Policy page. Essential shopping and security technologies stay on.",
      "You can request account or data assistance by contacting support.",
    ],
  },
  cookies: {
    title: "Cookie Policy",
    description:
      "How O & I Label uses cookies and similar technologies for essential shopping features, analytics, and marketing.",
    sections: [
      "Cookies and similar technologies are small pieces of data stored on your device or in your browser. They can help a website remember preferences, keep you signed in, and understand how the site is used. On O & I Label, some are essential for the store to work. Optional Analytics and Marketing technologies run only after you make an explicit choice.",
      "Essential (always on): required for core website functionality. This includes authentication and session handling through our authentication provider (Supabase), the private-store access cookie when that feature applies, and first-party browser storage used for shopping essentials such as cart, wishlist, Buy Now, checkout continuity, payment return, and order confirmation access. Turning off optional Analytics or Marketing does not disable these essential technologies, and it does not block browsing, cart, checkout, or payment flows.",
      "Analytics (optional): when you allow Analytics, we initialize Google Analytics 4 (GA4) in your browser to understand aggregate how visitors use O & I Label so we can improve the experience. If you decline Analytics, we do not initialize GA4 in your browser.",
      "Marketing (optional): when you allow Marketing, we initialize the Meta (Facebook) Pixel in your browser to help measure and improve advertising relevance and performance. If you decline Marketing, we do not initialize the browser Meta Pixel and we do not fire browser Meta Pixel events. Declining Marketing does not stop order processing, payment confirmation, or cart clearing. Separately, when an order is successfully paid, we may use server-side Meta Conversions API (CAPI) to help measure completed purchases and improve our advertising. This server-side processing is separate from the optional browser tracking controlled by your cookie preferences.",
      "You can Accept All, Reject All, or set Preferences from the cookie banner. After you decide, return to this Cookie Policy and use Cookie Settings below anytime to change your Analytics and Marketing preferences. Until you choose, optional Analytics and Marketing stay off. Absence of a stored choice is never treated as acceptance.",
      "When you enable Analytics or Marketing, Google or Meta may set or read their own cookies or similar technologies under their practices. We turn our browser GA4 and Meta Pixel integrations on or off based on your preference; we do not claim to delete or fully control third-party cookies already stored by those services.",
    ],
  },
  terms: {
    title: "Terms & Conditions",
    description: "Terms and conditions for shopping at O & I Label online.",
    sections: [
      "By placing an order, you agree to our pricing, product availability, and fulfillment terms.",
      "We may update product details, stock, and promotions without prior notice.",
      "For disputes or clarifications, contact support with your order details.",
    ],
  },
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICY_CONTENT[slug];
  if (!policy) {
    return buildPageMetadata({
      title: "Policy",
      description: "O & I Label store policies.",
      path: `/policies/${slug}`,
    });
  }
  return buildPageMetadata({
    title: policy.title,
    description: policy.description,
    path: `/policies/${slug}`,
  });
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const policy = POLICY_CONTENT[slug];
  if (!policy) notFound();

  return (
    <div className="border-b border-border/60 bg-background py-10 md:py-12">
      <Container className="max-w-3xl">
        <h1 className="font-serif-display text-3xl font-semibold tracking-tight">{policy.title}</h1>
        <div className="mt-6 space-y-4 text-sm text-muted-foreground md:text-base">
          {policy.sections.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        {slug === "cookies" ? (
          <div className="mt-8 space-y-3 border-t border-border/60 pt-6">
            <p className="text-sm text-muted-foreground md:text-base">
              Use Cookie Settings to review or update your optional Analytics and Marketing
              preferences at any time.
            </p>
            <CookieSettingsButton variant="navy" size="sm" />
          </div>
        ) : null}
      </Container>
    </div>
  );
}
