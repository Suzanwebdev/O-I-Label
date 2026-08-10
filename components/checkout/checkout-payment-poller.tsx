"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/cart-provider";

/**
 * While payment is still pending after MoMo approval, keep asking the server
 * to reconcile this order's unique payment reference with Moolre.
 * Clears purchased bag items as soon as payment is confirmed.
 */
export function CheckoutPaymentPoller({
  orderId,
  token,
  enabled,
}: {
  orderId: string;
  token: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const { clearPurchasedAfterPayment } = useCart();
  const [attempts, setAttempts] = React.useState(0);
  const clearedRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || !orderId || !token) return;
    if (attempts >= 24) return; // ~2 minutes at 5s

    const timer = window.setTimeout(async () => {
      try {
        const url = `/api/checkout/payment-status?order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const json = (await res.json()) as { paid?: boolean };
          if (json.paid) {
            if (!clearedRef.current) {
              clearedRef.current = true;
              clearPurchasedAfterPayment();
            }
            router.refresh();
            return;
          }
        }
      } catch {
        // keep polling
      }
      setAttempts((n) => n + 1);
    }, attempts === 0 ? 2500 : 5000);

    return () => window.clearTimeout(timer);
  }, [enabled, orderId, token, attempts, router, clearPurchasedAfterPayment]);

  if (!enabled) return null;

  return (
    <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
      Checking payment status{attempts > 0 ? `… (${attempts})` : "…"}
    </p>
  );
}
