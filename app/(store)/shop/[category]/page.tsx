import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import { listCategoriesFromDb, listProducts } from "@/lib/data/catalog";
import { buildCategoryDescription, buildCategoryKeywords } from "@/lib/seo/descriptions";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/seo/json-ld";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const categories = await listCategoriesFromDb();
  const selected = categories.find((c) => c.slug === category);
  if (!selected) {
    return buildPageMetadata({
      title: "Category Not Found",
      description: "Browse premium women's fashion at O & I Label.",
      path: `/shop/${category}`,
    });
  }

  return buildPageMetadata({
    title: `${selected.name} — Women's Fashion`,
    description: buildCategoryDescription(selected),
    path: `/shop/${selected.slug}`,
    keywords: buildCategoryKeywords(selected),
  });
}

export default async function CategoryShopPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const [products, categories] = await Promise.all([
    listProducts(),
    listCategoriesFromDb(),
  ]);

  const selected = categories.find((c) => c.slug === category);
  if (!selected) {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={[
          collectionPageJsonLd(selected),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: selected.name, path: `/shop/${selected.slug}` },
          ]),
        ]}
      />
      <Suspense fallback={<div className="px-6 py-10 text-sm text-muted-foreground">Loading category...</div>}>
        <ShopCatalog
          products={products}
          categorySlug={selected.slug}
          title={selected.name}
        />
      </Suspense>
    </>
  );
}
