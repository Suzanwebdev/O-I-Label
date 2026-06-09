"use client";

import * as React from "react";
import type { EffectiveStoreControl } from "@/lib/store-control/types";

const StoreControlContext = React.createContext<EffectiveStoreControl | null>(null);

export function StoreControlProvider({
  control,
  children,
}: {
  control: EffectiveStoreControl;
  children: React.ReactNode;
}) {
  return (
    <StoreControlContext.Provider value={control}>{children}</StoreControlContext.Provider>
  );
}

export function useStoreControl(): EffectiveStoreControl {
  const ctx = React.useContext(StoreControlContext);
  if (!ctx) {
    return {
      storeStatus: "live",
      browsingAllowed: true,
      checkoutAllowed: true,
      countdownEnabled: false,
      countdownTarget: null,
      maintenanceMessage: "",
      supportingMessage: null,
      presaleCtaLabel: "Join waitlist",
      reopeningDate: null,
      launchDate: null,
      presaleDate: null,
      presaleHeroImageUrl: null,
      maintenanceHeroImageUrl: null,
      launchHeroImageUrl: null,
      instagramUrl: null,
      whatsappUrl: null,
      bannerText: null,
      bannerEnabled: false,
      activeBanners: [],
      closedPageSlug: null,
      requiresPrivateAccess: false,
      isLive: true,
      showWaitlistCount: true,
      waitlistCount: 0,
      softCloseMode: false,
    };
  }
  return ctx;
}
