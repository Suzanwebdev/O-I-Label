import Link from "next/link";
import {
  HomepageProductOrderManager,
  type HomepageOrderProduct,
} from "@/components/admin/homepage-product-order-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listProducts } from "@/lib/data/catalog";
import { getHomeContentSectionsAdmin } from "@/lib/data/homepage-cms";
import { parseBestSellersProductOrder } from "@/lib/home/homepage-product-order";
import { buildHomeBestSellersList } from "@/lib/shop-utils";

export default async function AdminPagesHomepagePage() {
  const [catalog, sections] = await Promise.all([listProducts(), getHomeContentSectionsAdmin()]);
  const orderedIds = parseBestSellersProductOrder(sections);
  const ordered = buildHomeBestSellersList(catalog, orderedIds);

  const products: HomepageOrderProduct[] = ordered.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.images[0] ?? null,
    isBestSeller: p.badges.includes("best_seller"),
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pages</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Homepage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All products shown in the homepage Best Sellers section — tagged or not. Move them into the
          order you want customers to see.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Hero copy, banners, and section titles stay under{" "}
          <Link href="/admin/homepage" className="font-medium text-foreground underline underline-offset-2">
            Content → Homepage
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Best Sellers product order</CardTitle>
          <CardDescription>
            {products.length} product{products.length === 1 ? "" : "s"} currently eligible for this
            section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HomepageProductOrderManager products={products} />
        </CardContent>
      </Card>
    </div>
  );
}
