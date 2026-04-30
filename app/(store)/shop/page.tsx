import { Suspense } from "react";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import { listProducts } from "@/lib/data/catalog";

export default async function ShopPage() {
  const products = await listProducts();

  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-muted-foreground">Loading catalog...</div>}>
      <ShopCatalog products={products} title="All pieces" />
    </Suspense>
  );
}
