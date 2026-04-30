import Link from "next/link";
import { ProductCreateForm } from "@/components/admin/product-create-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminCategories } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

export default async function AdminNewProductPage() {
  const categories = await listAdminCategories();
  return (
    <Card className="max-w-6xl rounded-[var(--radius-lg)]">
      <CardHeader>
        <CardTitle>New product</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload product photos, set each size and colour as its own variant (with stock and price), then publish or save as
          draft.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProductCreateForm
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
          }))}
        />
        <p className="text-xs text-muted-foreground">
          Need a category first?{" "}
          <Link href="/admin/categories" className="underline hover:text-foreground">
            Create one here
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
