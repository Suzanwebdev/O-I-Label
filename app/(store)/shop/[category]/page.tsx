import { notFound } from "next/navigation";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import { listCategoriesFromDb, listProducts } from "@/lib/data/catalog";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

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
    <ShopCatalog
      products={products}
      categorySlug={selected.slug}
      title={selected.name}
    />
  );
}
