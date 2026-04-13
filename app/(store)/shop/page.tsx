import { Suspense } from "react";
import { ShopCatalog } from "@/components/shop/shop-catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { listProducts } from "@/lib/data/catalog";

export default async function ShopPage() {
  const products = await listProducts();
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-[1400px] px-4 py-14">
          <Skeleton className="mb-8 h-10 w-64" />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        </div>
      }
    >
      <ShopCatalog products={products} title="All pieces" />
    </Suspense>
  );
}
