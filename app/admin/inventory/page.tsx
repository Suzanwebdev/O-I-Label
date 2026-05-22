import Link from "next/link";
import { InventoryStockTable } from "@/components/admin/inventory-stock-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminProductById, listAdminInventory } from "@/lib/data/admin";

type Props = {
  searchParams: Promise<{ product?: string }>;
};

export default async function AdminInventoryPage({ searchParams }: Props) {
  const { product: productId } = await searchParams;
  const trimmedId = productId?.trim() || undefined;

  const [rows, productDetail] = await Promise.all([
    listAdminInventory(trimmedId ? { productId: trimmedId } : undefined),
    trimmedId ? getAdminProductById(trimmedId) : Promise.resolve(null),
  ]);

  const filterProduct =
    trimmedId && (productDetail || rows.length)
      ? {
          id: trimmedId,
          name: productDetail?.name ?? rows[0]?.product_name ?? "Product",
          slug: productDetail?.slug ?? rows[0]?.product_slug ?? "",
        }
      : null;

  const scoped = Boolean(filterProduct);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
        {scoped ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/inventory">View all inventory</Link>
          </Button>
        ) : null}
      </div>

      {scoped && filterProduct ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            Showing stock for{" "}
            <span className="font-medium text-foreground">{filterProduct.name}</span>
            {filterProduct.slug ? (
              <span className="text-muted-foreground"> · {filterProduct.slug}</span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Opened from Products. Use <strong>View all inventory</strong> to see every SKU in the store.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {scoped ? "Variant stock for this product" : "Variant stock"}
          </CardTitle>
          <CardDescription>
            Adjust quantity per SKU, then choose <strong>Save</strong>. You must be signed in as an admin or staff row
            in Supabase <span className="font-mono">admins</span>; otherwise saves return an access error.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <InventoryStockTable rows={rows} scopedToProduct={scoped} />
          ) : scoped && filterProduct ? (
            <p className="text-sm text-muted-foreground">
              No variants found for <span className="font-medium text-foreground">{filterProduct.name}</span>. Add
              size/colour variants on the{" "}
              <Link href={`/admin/products/${filterProduct.id}`} className="text-navy underline-offset-4 hover:underline">
                product edit
              </Link>{" "}
              page.
            </p>
          ) : trimmedId && !filterProduct ? (
            <p className="text-sm text-muted-foreground">
              Product not found.{" "}
              <Link href="/admin/inventory" className="text-navy underline-offset-4 hover:underline">
                View all inventory
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No variants found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
