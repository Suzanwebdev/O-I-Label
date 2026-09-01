"use client";

import * as React from "react";
import { trackPurchase } from "@/lib/analytics/ga4";
import type { Ga4PurchaseParams } from "@/lib/analytics/ga4-events";
import { purchaseStorageKey, shouldFireDedupedEvent } from "@/lib/analytics/ga4-events";

type PurchaseTrackerProps = {
  orderId: string;
  state: "paid" | "failed" | "pending";
  isDemo: boolean;
  purchase: Ga4PurchaseParams | null;
};

export function PurchaseTracker({ orderId, state, isDemo, purchase }: PurchaseTrackerProps) {
  React.useEffect(() => {
    if (isDemo || state !== "paid" || !orderId || !purchase) return;

    const key = purchaseStorageKey(orderId);
    if (!shouldFireDedupedEvent(sessionStorage, key)) return;

    trackPurchase(purchase);
  }, [orderId, state, isDemo, purchase]);

  return null;
}
