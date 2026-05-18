import { StoreHeader } from "@/components/layout/store-header";
import { StoreFooter } from "@/components/layout/store-footer";
import { ScrollProgress } from "@/components/layout/scroll-progress";
import { CartDrawer } from "@/components/store/cart-drawer";
import { CatalogRefresh } from "@/components/realtime/catalog-refresh";
import { getHomepageCms } from "@/lib/data/homepage-cms";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { footer } = await getHomepageCms();

  return (
    <>
      <CatalogRefresh />
      <ScrollProgress />
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter footer={footer} />
      <CartDrawer />
    </>
  );
}
