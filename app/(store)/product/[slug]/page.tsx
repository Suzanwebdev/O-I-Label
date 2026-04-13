import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getProductBySlug, mockProducts } from "@/lib/mock-data";
import { getProductBySlugFromDb, listProducts } from "@/lib/data/catalog";
import { Container } from "@/components/store/container";
import { BadgeSet } from "@/components/store/badge-set";
import { Price } from "@/components/store/price";
import { Separator } from "@/components/ui/separator";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductVariantForm } from "@/components/product/product-variant-form";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return mockProducts.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p =
    (await getProductBySlugFromDb(slug)) ?? getProductBySlug(slug);
  if (!p) return {};
  return {
    title: p.name,
    description: p.description.slice(0, 160),
    openGraph: { images: p.images[0] ? [p.images[0]] : [] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product =
    (await getProductBySlugFromDb(slug)) ?? getProductBySlug(slug);
  if (!product) notFound();

  const catalog = await listProducts();

  const lowStock = product.variants.some(
    (v) => v.stock > 0 && v.stock <= 8
  );

  return (
    <Container className="py-10 md:py-14">
      <div className="mb-6 text-sm text-muted-foreground">
        <Link href="/shop" className="hover:text-navy">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/shop/${product.category_slug}`}
          className="hover:text-navy"
        >
          {product.category_name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} name={product.name} />
        <div className="space-y-6">
          <BadgeSet badges={product.badges} />
          <h1 className="font-serif-display text-3xl tracking-tight md:text-4xl">
            {product.name}
          </h1>
          {product.rating != null ? (
            <p className="text-sm text-muted-foreground">
              {product.rating.toFixed(1)} rating · {product.review_count}{" "}
              reviews
            </p>
          ) : null}
          <p className="max-w-prose leading-relaxed text-muted-foreground">
            {product.description}
          </p>
          <Separator />
          <ProductVariantForm product={product} />
          <div className="rounded-[var(--radius-lg)] border border-border bg-muted/40 p-4 text-sm space-y-2">
            <p>
              <span className="font-medium text-foreground">Delivery: </span>
              Estimated 2–5 business days within Ghana. International rates at
              checkout.
            </p>
            <p>
              <span className="font-medium text-foreground">Returns: </span>
              14 days for unworn items with tags attached.{" "}
              <Link href="/policies/returns" className="text-navy underline">
                Read policy
              </Link>
            </p>
            {lowStock ? (
              <p className="text-navy font-medium">
                Low stock — your size may not restock this season.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <section className="mt-20 border-t border-border pt-16">
        <h2 className="font-serif-display text-2xl">You may also love</h2>
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          {catalog
            .filter(
              (p) =>
                p.category_slug === product.category_slug && p.id !== product.id
            )
            .slice(0, 4)
            .map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                className="group space-y-3"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted">
                  <Image
                    src={p.images[0]}
                    alt={p.name}
                    fill
                    className="object-cover transition group-hover:scale-[1.02]"
                    sizes="25vw"
                  />
                </div>
                <p className="font-serif-display text-base group-hover:text-navy">
                  {p.name}
                </p>
              </Link>
            ))}
        </div>
      </section>
    </Container>
  );
}
