"use client";

import * as React from "react";
import { trackViewItem } from "@/lib/analytics/ga4";
import {
  buildViewItemEvent,
  shouldFireDedupedEvent,
  viewItemStorageKey,
} from "@/lib/analytics/ga4-events";

type ProductViewTrackerProps = {
  productId: string;
  productName: string;
  categoryName?: string;
  priceGhs: number;
  size?: string | null;
  color?: string | null;
};

export function ProductViewTracker({
  productId,
  productName,
  categoryName,
  priceGhs,
  size,
  color,
}: ProductViewTrackerProps) {
  React.useEffect(() => {
    const key = viewItemStorageKey(productId);
    if (!shouldFireDedupedEvent(sessionStorage, key)) return;

    trackViewItem(
      buildViewItemEvent({
        productId,
        productName,
        categoryName,
        priceGhs,
        size,
        color,
      })
    );
    // Fire once per product ID; variant changes must not re-trigger view_item.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional productId-only dedupe
  }, [productId]);

  return null;
}
