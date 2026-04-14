import { StoreHeader } from "@/components/layout/store-header";
import { StoreFooter } from "@/components/layout/store-footer";
import { ScrollProgress } from "@/components/layout/scroll-progress";
import { CartDrawer } from "@/components/store/cart-drawer";
import { CatalogRefresh } from "@/components/realtime/catalog-refresh";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CatalogRefresh />
      <ScrollProgress />
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter />
      <CartDrawer />
    </>
  );
}
