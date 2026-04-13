import { notFound } from "next/navigation";
import { Container } from "@/components/store/container";
import type { Metadata } from "next";

const policies: Record<string, { title: string; content: string[] }> = {
  shipping: {
    title: "Shipping",
    content: [
      "We dispatch within 1–2 business days for in-stock items. You will receive tracking by email once the carrier scans your parcel.",
      "Domestic Ghana: estimated 2–5 business days depending on region. International timelines vary by destination and customs.",
      "Duties and taxes may apply internationally and are the responsibility of the customer unless otherwise stated at checkout.",
    ],
  },
  returns: {
    title: "Returns",
    content: [
      "You may return unworn items with tags attached within 14 days of delivery for a refund or store credit, subject to inspection.",
      "Initiate a return from your account or by contacting support with your order number. Return shipping may be deducted unless the item is faulty.",
      "Sale items marked final sale cannot be returned unless required by law.",
    ],
  },
  privacy: {
    title: "Privacy",
    content: [
      "We collect information you provide at checkout and when you create an account, including contact details and order history.",
      "Payments are processed by our gateway partners; we do not store full card numbers on our servers.",
      "You may request deletion of your account data subject to legal retention requirements for transactions.",
    ],
  },
  terms: {
    title: "Terms of use",
    content: [
      "By using this site you agree to these terms and our policies. We may update them periodically; continued use constitutes acceptance.",
      "Product imagery is representative; slight colour variance may occur due to display calibration.",
      "We reserve the right to refuse service where fraud or abuse is suspected.",
    ],
  },
};

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = policies[slug];
  if (!p) return {};
  return { title: p.title };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const p = policies[slug];
  if (!p) notFound();

  return (
    <Container className="max-w-3xl py-14 md:py-20">
      <h1 className="font-serif-display text-3xl md:text-4xl">{p.title}</h1>
      <div className="mt-10 space-y-6 text-muted-foreground leading-relaxed">
        {p.content.map((block, i) => (
          <p key={i}>{block}</p>
        ))}
      </div>
    </Container>
  );
}
