"use client";

import * as React from "react";
import { trackViewItem } from "@/lib/analytics/ga4";
import { trackMetaViewContent } from "@/lib/analytics/meta";
import {
  buildViewItemEvent,
  shouldFireDedupedEvent,
  viewItemStorageKey,
} from "@/lib/analytics/ga4-events";
import {
  buildMetaViewContentEvent,
  viewContentStorageKey,
} from "@/lib/analytics/meta-events";

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
    const gaKey = viewItemStorageKey(productId);
    if (shouldFireDedupedEvent(sessionStorage, gaKey)) {
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
    }

    const metaKey = viewContentStorageKey(productId);
    if (shouldFireDedupedEvent(sessionStorage, metaKey)) {
      trackMetaViewContent(
        buildMetaViewContentEvent({
          productId,
          productName,
          categoryName,
          priceGhs,
        })
      );
    }
    // Fire once per product ID; variant changes must not re-trigger view_item / ViewContent.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional productId-only dedupe
  }, [productId]);

  return null;
}
