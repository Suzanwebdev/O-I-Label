"use client";

import * as React from "react";
import { trackPurchase } from "@/lib/analytics/ga4";
import { trackMetaPurchase } from "@/lib/analytics/meta";
import type { Ga4PurchaseParams } from "@/lib/analytics/ga4-events";
import { purchaseStorageKey, shouldFireDedupedEvent } from "@/lib/analytics/ga4-events";
import { buildMetaPurchaseEvent, metaPurchaseStorageKey } from "@/lib/analytics/meta-events";

type PurchaseTrackerProps = {
  orderId: string;
  state: "paid" | "failed" | "pending";
  isDemo: boolean;
  purchase: Ga4PurchaseParams | null;
};

export function PurchaseTracker({ orderId, state, isDemo, purchase }: PurchaseTrackerProps) {
  React.useEffect(() => {
    if (isDemo || state !== "paid" || !orderId || !purchase) return;

    const gaKey = purchaseStorageKey(orderId);
    if (shouldFireDedupedEvent(sessionStorage, gaKey)) {
      trackPurchase(purchase);
    }

    const metaKey = metaPurchaseStorageKey(orderId);
    if (shouldFireDedupedEvent(sessionStorage, metaKey)) {
      trackMetaPurchase(buildMetaPurchaseEvent(purchase), orderId);
    }
  }, [orderId, state, isDemo, purchase]);

  return null;
}
