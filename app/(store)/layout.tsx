import { StoreHeader } from "@/components/layout/store-header";
import { StoreFooter } from "@/components/layout/store-footer";
import { ScrollProgress } from "@/components/layout/scroll-progress";
import { CartDrawer } from "@/components/store/cart-drawer";
import { CatalogRefresh } from "@/components/realtime/catalog-refresh";
import { StoreControlProvider } from "@/components/store-control/store-control-provider";
import { StoreAnnouncementBanner } from "@/components/store-control/store-banner";
import { PresaleLaunchStrip } from "@/components/store-control/presale-strip";
import { SoftCloseBanner } from "@/components/store-control/soft-close-banner";
import { getHomepageCms } from "@/lib/data/homepage-cms";
import { getEffectiveStoreControl } from "@/lib/store-control/server";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ footer }, control] = await Promise.all([getHomepageCms(), getEffectiveStoreControl()]);

  return (
    <StoreControlProvider control={control}>
      <CatalogRefresh />
      <ScrollProgress />
      <StoreAnnouncementBanner />
      <SoftCloseBanner />
      <PresaleLaunchStrip />
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter footer={footer} />
      <CartDrawer />
    </StoreControlProvider>
  );
}
