import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/store/container";
import { listPublishedBlogPosts } from "@/lib/data/blog";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { format } from "date-fns";

export const metadata = buildPageMetadata({
  title: "Style Journal",
  description:
    "Editorial notes, styling ideas, and new arrivals from O & I Label — premium women's fashion.",
  path: "/blog",
  keywords: ["style journal", "fashion blog", "O & I Label editorial"],
});

export default async function BlogIndexPage() {
  const posts = await listPublishedBlogPosts();

  return (
    <div className="border-b border-border/60 bg-background py-10 md:py-14">
      <Container className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Journal</p>
        <h1 className="mt-2 font-serif-display text-3xl font-semibold tracking-tight md:text-4xl">
          Style Journal
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
          Editorial styling, occasion edits, and notes from the O &amp; I Label studio.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            New stories are on the way. Browse the{" "}
            <Link href="/shop" className="text-navy underline underline-offset-4">
              shop
            </Link>{" "}
            in the meantime.
          </p>
        ) : (
          <ul className="mt-10 divide-y divide-border">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex gap-5 py-8 transition-colors hover:bg-muted/30 -mx-4 px-4 md:-mx-6 md:px-6"
                >
                  {post.coverUrl ? (
                    <div className="relative hidden h-24 w-20 shrink-0 overflow-hidden bg-muted sm:block">
                      <Image
                        src={post.coverUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {post.publishedAt ? (
                      <time
                        dateTime={post.publishedAt}
                        className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        {format(new Date(post.publishedAt), "d MMM yyyy")}
                      </time>
                    ) : null}
                    <h2 className="mt-1 font-serif-display text-xl font-semibold tracking-tight group-hover:text-navy md:text-2xl">
                      {post.title}
                    </h2>
                    {post.excerpt ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                    ) : null}
                    <span className="mt-3 inline-block text-xs font-medium text-navy">Read more</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </div>
  );
}
