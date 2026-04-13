import { notFound } from "next/navigation";
import { Container } from "@/components/store/container";
import type { Metadata } from "next";

const posts: Record<string, { title: string; body: string[] }> = {
  "how-to-build-a-capsule-wardrobe": {
    title: "How to build a capsule wardrobe without feeling boring",
    body: [
      "Start with three dependable bases: a tailored trouser, a sculpting dress, and denim with intention.",
      "Layer texture before colour. Matte jersey against ribbed knit reads expensive without shouting.",
      "Reserve one statement piece per season — a coat, a boot, a bag — and let everything else support it.",
    ],
  },
  "denim-fit-guide": {
    title: "The fit guide: denim that flatters every curve",
    body: [
      "Rise sets the proportion: high rise elongates the leg; mid rise relaxes the waist.",
      "Break at the shoe should feel deliberate — a clean hem or a single stack, never accidental fray.",
      "Wash is mood: deep indigo for evening, vintage mid for weekend, true black for everything between.",
    ],
  },
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = posts[slug];
  if (!p) return {};
  return { title: p.title };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const p = posts[slug];
  if (!p) notFound();

  return (
    <Container className="max-w-3xl py-14 md:py-20">
      <p className="text-xs font-semibold uppercase tracking-wider text-navy">
        Style Journal
      </p>
      <h1 className="mt-4 font-serif-display text-3xl md:text-4xl">{p.title}</h1>
      <article className="prose prose-neutral mt-10 max-w-none space-y-6 text-muted-foreground">
        {p.body.map((para) => (
          <p key={para.slice(0, 20)}>{para}</p>
        ))}
      </article>
    </Container>
  );
}
