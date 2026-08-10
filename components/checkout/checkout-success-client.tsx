"use client";

import * as React from "react";
import { useCart } from "@/components/providers/cart-provider";

export function CheckoutSuccessClient({
  shouldClearSelected,
}: {
  shouldClearSelected: boolean;
}) {
  const { clearPurchasedAfterPayment } = useCart();
  const [cleared, setCleared] = React.useState(false);

  React.useEffect(() => {
    if (!shouldClearSelected || cleared) return;
    clearPurchasedAfterPayment();
    setCleared(true);
  }, [shouldClearSelected, cleared, clearPurchasedAfterPayment]);

  return null;
}
