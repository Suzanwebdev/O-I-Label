import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/store/container";
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
      "You can request account or data assistance by contacting support.",
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
      </Container>
    </div>
  );
}

