"use client";

import * as React from "react";
import { useCart } from "@/components/providers/cart-provider";

export function CheckoutSuccessClient({
  shouldClearSelected,
}: {
  shouldClearSelected: boolean;
}) {
  const { removePurchasedLines } = useCart();
  const [cleared, setCleared] = React.useState(false);

  React.useEffect(() => {
    if (!shouldClearSelected || cleared) return;
    removePurchasedLines();
    setCleared(true);
  }, [shouldClearSelected, cleared, removePurchasedLines]);

  return null;
}

