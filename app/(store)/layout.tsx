import { ConsentProvider } from "@/components/consent/consent-provider";
import { ConsentGatedStoreAnalytics } from "@/components/consent/consent-gated-store-analytics";
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
import { getAccountUserEmail } from "@/lib/data/account-orders";
import { listCategoriesFromDb } from "@/lib/data/catalog";
import { getStorefrontStoreControl } from "@/lib/store-control/public-cache";
import { storefrontShowsWaitlistCount } from "@/lib/store-control/waitlist-display";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ footer }, control, categories, accountEmail] = await Promise.all([
    getHomepageCms(),
    getStorefrontStoreControl({ includeWaitlistCount: storefrontShowsWaitlistCount }),
    listCategoriesFromDb(),
    getAccountUserEmail(),
  ]);

  return (
    <StoreControlProvider control={control}>
      <ConsentProvider>
        <CatalogRefresh />
        <ScrollProgress />
        <StoreAnnouncementBanner />
        <SoftCloseBanner />
        <PresaleLaunchStrip />
        <StoreHeader categories={categories} accountEmail={accountEmail} />
        <main className="flex-1">{children}</main>
        <StoreFooter footer={footer} />
        <CartDrawer />
        <ConsentGatedStoreAnalytics />
      </ConsentProvider>
    </StoreControlProvider>
  );
}
