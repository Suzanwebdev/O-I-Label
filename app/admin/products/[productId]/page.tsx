import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCreateForm } from "@/components/admin/product-create-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminProductById, listAdminCategories } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ productId: string }> };

export default async function AdminEditProductPage({ params }: Props) {
  const { productId } = await params;
  const [categories, product] = await Promise.all([
    listAdminCategories(),
    getAdminProductById(productId),
  ]);
  if (!product) notFound();

  const effectiveCategoryId =
    product.category_id && categories.some((c) => c.id === product.category_id)
      ? product.category_id
      : categories[0]?.id ?? null;

  return (
    <Card className="max-w-6xl rounded-[var(--radius-lg)]">
      <CardHeader>
        <CardTitle>Edit product</CardTitle>
        <p className="text-sm text-muted-foreground">
          Change copy, gallery, variants, pricing, badges, or occasion tags. Removing a SKU deletes that cart line item for carts
          that still reference it.
        </p>
        <p className="text-xs text-muted-foreground">
          <Link href="/admin/products" className="underline underline-offset-2 hover:text-foreground">
            ← Back to Products
          </Link>
          {" · "}
          <Link href={`/product/${product.slug}`} target="_blank" className="underline underline-offset-2 hover:text-foreground">
            View storefront
          </Link>
        </p>
      </CardHeader>
      <CardContent>
        <ProductCreateForm
          categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
          editProduct={{
            ...product,
            category_id: effectiveCategoryId,
          }}
        />
      </CardContent>
    </Card>
  );
}
