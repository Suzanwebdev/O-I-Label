import Link from "next/link";
import { Container } from "@/components/store/container";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Contact & Customer Support",
  description:
    "Contact O & I Label for order support, sizing help, and styling advice. Premium women's fashion customer care in Ghana.",
  path: "/contact",
  keywords: ["contact O & I Label", "customer support", "fashion help Ghana"],
});

const TOPIC_COPY: Record<string, { title: string; body: string }> = {
  "size-guide": {
    title: "Size Guide Support",
    body: "Need help choosing your size? Share your bust, waist, and hip measurements and we will recommend the best fit.",
  },
  faq: {
    title: "Frequently Asked Questions",
    body: "Ask us anything about orders, shipping, returns, or care instructions and we will respond quickly.",
  },
};

type Props = {
  searchParams: Promise<{ topic?: string }>;
};

export default async function ContactPage({ searchParams }: Props) {
  const { topic } = await searchParams;
  const normalized = (topic ?? "").trim().toLowerCase();
  const panel = TOPIC_COPY[normalized] ?? {
    title: "Help & Contact",
    body: "For product questions, order support, or styling help, contact our team on WhatsApp or email.",
  };

  return (
    <div className="border-b border-border/60 bg-background py-10 md:py-12">
      <Container className="max-w-3xl">
        <h1 className="font-serif-display text-3xl font-semibold tracking-tight">{panel.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">{panel.body}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a
            href="https://api.whatsapp.com/send?phone=233503163721&text=Hello%20O%20%26%20I%20Label%2C%20I%20need%20help%20with%20an%20order."
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Chat on WhatsApp
          </a>
          <a
            href="mailto:hello@oi-label.com"
            className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Email hello@oi-label.com
          </a>
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            You can also <Link href="/track-order" className="underline">track your order</Link> or review{" "}
            <Link href="/policies/shipping" className="underline">shipping policy</Link>.
          </p>
        </div>
      </Container>
    </div>
  );
}

