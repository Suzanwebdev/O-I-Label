"use client";

import * as React from "react";
import { trackPurchase } from "@/lib/analytics/ga4";
import type { Ga4PurchaseParams } from "@/lib/analytics/ga4-events";
import { purchaseStorageKey, shouldFireDedupedEvent } from "@/lib/analytics/ga4-events";
import { buildMetaPurchaseEvent } from "@/lib/analytics/meta-events";
import {
  META_PURCHASE_FBQ_RETRY_ATTEMPTS,
  META_PURCHASE_FBQ_RETRY_INTERVAL_MS,
  tryDispatchMetaPurchaseWithDedupe,
} from "@/lib/analytics/meta-purchase";

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

    const payload = buildMetaPurchaseEvent(purchase);
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (cancelled) return;

      const result = tryDispatchMetaPurchaseWithDedupe(sessionStorage, orderId, payload);
      if (result === "sent" || result === "already" || result === "disabled") return;

      attempt += 1;
      if (attempt < META_PURCHASE_FBQ_RETRY_ATTEMPTS) {
        timer = setTimeout(tick, META_PURCHASE_FBQ_RETRY_INTERVAL_MS);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, state, isDemo, purchase]);

  return null;
}
