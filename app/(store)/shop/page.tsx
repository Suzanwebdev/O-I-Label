import { ShopCatalog } from "@/components/shop/shop-catalog";
import { listProducts } from "@/lib/data/catalog";

export default async function ShopPage() {
  const products = await listProducts();

  return <ShopCatalog products={products} title="All pieces" />;
}
