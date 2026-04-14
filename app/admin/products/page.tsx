import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminProductsTable } from "@/components/admin/admin-products-table";
import { listAdminProducts } from "@/lib/data/admin";

export default async function AdminProductsPage() {
  const products = await listAdminProducts();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif-display text-2xl">Products</h1>
        <Button asChild size="sm">
          <Link href="/admin/products/new">New product</Link>
        </Button>
      </div>
      <AdminProductsTable products={products} />
    </div>
  );
}
