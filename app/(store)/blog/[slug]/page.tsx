import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Container } from "@/components/store/container";
import { getPublishedBlogPostBySlug, listPublishedBlogPosts } from "@/lib/data/blog";
import { buildPageMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await listPublishedBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) return {};
  return buildPageMetadata({
    title: post.title,
    description: post.excerpt ?? post.title,
    path: `/blog/${post.slug}`,
    ogType: "article",
    ogImage: post.coverUrl,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="border-b border-border/60 bg-background py-10 md:py-14">
      <Container className="max-w-2xl">
        <Link
          href="/blog"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Style Journal
        </Link>
        {post.publishedAt ? (
          <time
            dateTime={post.publishedAt}
            className="mt-6 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            {format(new Date(post.publishedAt), "d MMMM yyyy")}
          </time>
        ) : null}
        <h1 className="mt-2 font-serif-display text-3xl font-semibold tracking-tight md:text-4xl">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="mt-4 text-base text-muted-foreground md:text-lg">{post.excerpt}</p>
        ) : null}
        {post.coverUrl ? (
          <div className="relative mt-8 aspect-[16/10] overflow-hidden bg-muted">
            <Image
              src={post.coverUrl}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
              priority
            />
          </div>
        ) : null}
        <div className="prose-store mt-8 space-y-4 text-sm leading-relaxed text-foreground md:text-base">
          {post.body.split(/\n{2,}/).map((block, i) => (
            <p key={i}>{block.trim()}</p>
          ))}
        </div>
      </Container>
    </article>
  );
}
