import { notFound } from "next/navigation";
import { Container } from "@/components/store/container";

const POLICY_CONTENT: Record<string, { title: string; sections: string[] }> = {
  shipping: {
    title: "Shipping & Delivery",
    sections: [
      "Orders are processed after payment confirmation. Delivery timelines vary by location and are shared at checkout or by support.",
      "Please ensure your phone number and delivery details are accurate to avoid delays.",
      "For urgent delivery support, contact us on WhatsApp with your order number.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      "We collect only the information required to process orders, support customers, and improve your shopping experience.",
      "Your data is handled securely and never sold to third parties.",
      "You can request account or data assistance by contacting support.",
    ],
  },
  terms: {
    title: "Terms & Conditions",
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

