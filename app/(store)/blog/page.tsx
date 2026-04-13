import Link from "next/link";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";

const posts = [
  {
    slug: "how-to-build-a-capsule-wardrobe",
    title: "How to build a capsule wardrobe without feeling boring",
    excerpt:
      "Five silhouettes, three textures, infinite combinations — an editorial approach to fewer, better pieces.",
  },
  {
    slug: "denim-fit-guide",
    title: "The fit guide: denim that flatters every curve",
    excerpt:
      "Rise, break, and wash explained with the same rigour we apply in the design room.",
  },
];

export default function BlogIndexPage() {
  return (
    <Container className="py-14 md:py-20">
      <Heading as="h1" eyebrow="Style Journal">
        Stories & styling
      </Heading>
      <ul className="mt-12 space-y-10">
        {posts.map((p) => (
          <li key={p.slug} className="max-w-2xl border-b border-border pb-10">
            <Link
              href={`/blog/${p.slug}`}
              className="font-serif-display text-2xl hover:text-navy md:text-3xl"
            >
              {p.title}
            </Link>
            <p className="mt-3 text-muted-foreground">{p.excerpt}</p>
            <Link
              href={`/blog/${p.slug}`}
              className="mt-4 inline-block text-sm font-medium text-navy underline-offset-4 hover:underline"
            >
              Read
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
