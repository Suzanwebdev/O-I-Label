"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";
import { useStoreControl } from "@/components/store-control/store-control-provider";
import { VipWaitlistForm } from "@/components/store-control/vip-waitlist-form";

type CartPayload = Parameters<ReturnType<typeof useCart>["addItem"]>[0];

export function PurchaseActions({
  productSlug,
  cartPayload,
  className,
  layout = "stack",
  onAfterAdd,
}: {
  productSlug: string;
  cartPayload: CartPayload;
  className?: string;
  layout?: "stack" | "row";
  onAfterAdd?: () => void;
}) {
  const control = useStoreControl();
  const { addItem, openCart } = useCart();

  if (control.checkoutAllowed) {
    const rowLayout = layout === "row";
    return (
      <div
        className={
          rowLayout
            ? `flex flex-col gap-2 pt-0.5 sm:flex-row ${className ?? ""}`
            : className
        }
      >
        <Button
          type="button"
          size="sm"
          className={
            rowLayout
              ? "h-10 min-h-10 flex-1 gap-2 bg-black text-[11px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] hover:bg-black/90 sm:h-9 sm:min-h-9"
              : "h-10 min-h-10 w-full gap-2 bg-black text-[11px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] hover:bg-black/90 sm:h-9 sm:min-h-9"
          }
          onClick={() => {
            addItem(cartPayload);
            openCart();
            onAfterAdd?.();
          }}
        >
          <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
          Add to cart
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className={
            rowLayout
              ? "h-10 min-h-10 flex-1 border-black/20 text-[11px] font-medium sm:h-9 sm:min-h-9"
              : "mt-2 h-10 min-h-10 w-full border-black/20 text-[11px] font-medium sm:h-9 sm:min-h-9"
          }
        >
          <Link href={`/product/${productSlug}`}>Buy now</Link>
        </Button>
      </div>
    );
  }

  if (control.softCloseMode) {
    return (
      <p className={`text-center text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}>
        {control.maintenanceMessage ||
          "Purchasing is temporarily unavailable while we prepare our next edit."}
      </p>
    );
  }

  return (
    <div className={className}>
      <VipWaitlistForm
        source={`presale:${productSlug}`.slice(0, 64)}
        productSlug={productSlug}
        ctaLabel={control.presaleCtaLabel}
        compact
      />
    </div>
  );
}
