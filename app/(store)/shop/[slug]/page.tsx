import { notFound } from "next/navigation";
import { Suspense } from "react";
import { mockCategories } from "@/lib/mock-data";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { listProducts, listCategoriesFromDb } from "@/lib/data/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return mockCategories.map((c) => ({ slug: c.slug }));
}

export default async function CategoryShopPage({ params }: Props) {
  const { slug } = await params;
  const categories = await listCategoriesFromDb();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();
  const products = await listProducts();

  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-[1400px] px-4 py-14">
          <Skeleton className="mb-8 h-10 w-64" />
        </div>
      }
    >
      <ShopCatalog
        products={products}
        categorySlug={slug}
        title={cat.name}
      />
    </Suspense>
  );
}
