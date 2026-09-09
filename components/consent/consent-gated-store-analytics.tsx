"use client";

import { StoreGoogleAnalytics } from "@/components/analytics/google-analytics";
import { StoreMetaPixel } from "@/components/analytics/meta-pixel";
import { MetaPageViewTracker } from "@/components/analytics/meta-page-view";
import { useConsent } from "@/components/consent/consent-provider";

/**
 * Mounts storefront browser analytics only after an explicit consent decision.
 * Prevents GA4 / Meta Pixel from loading on the initial server render or before
 * the visitor chooses.
 */
export function ConsentGatedStoreAnalytics() {
  const { ready, analyticsAllowed, marketingAllowed } = useConsent();

  if (!ready) return null;

  return (
    <>
      {analyticsAllowed ? <StoreGoogleAnalytics /> : null}
      {marketingAllowed ? (
        <>
          <StoreMetaPixel />
          <MetaPageViewTracker />
        </>
      ) : null}
    </>
  );
}
