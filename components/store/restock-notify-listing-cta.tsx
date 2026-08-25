"use client";

import * as React from "react";
import type { StorefrontProduct } from "@/lib/catalog/storefront-product";
import { Button } from "@/components/ui/button";
import { RestockNotifyDialog } from "@/components/store/restock-notify-dialog";
import { SoldOutMessage } from "@/components/store/sold-out-message";
import { shouldShowRestockNotify } from "@/lib/restock-notifications/ui";
import { cn } from "@/lib/utils";

type Props = {
  product: StorefrontProduct;
  /** Analytics source for the subscribe API. */
  source?: "card" | "quick_view";
  className?: string;
  /** Match existing sold-out text sizing on compact rows. */
  soldOutSize?: "xs" | "sm";
  /** Compact button for homepage strips / dense cards. */
  compact?: boolean;
};

/**
 * Sold-out listing CTA: keep “Sold out” copy and open the shared restock dialog
 * only when the entire product is sold out (same rule as PDP).
 */
export function RestockNotifyListingCta({
  product,
  source = "card",
  className,
  soldOutSize = "sm",
  compact = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const showNotify = shouldShowRestockNotify(product);

  return (
    <div className={cn("space-y-2", className)}>
      <SoldOutMessage size={soldOutSize} />
      {showNotify ? (
        <>
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            className={cn(
              "w-full rounded-[var(--radius-lg)] border-black/25 bg-white font-medium transition-colors hover:bg-muted",
              compact && "h-9 text-xs md:text-[13px]"
            )}
            onClick={() => setOpen(true)}
          >
            Notify Me
          </Button>
          <RestockNotifyDialog
            product={product}
            open={open}
            onOpenChange={setOpen}
            source={source}
          />
        </>
      ) : null}
    </div>
  );
}
