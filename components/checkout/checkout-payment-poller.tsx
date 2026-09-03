"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import {
  isPaymentPollExhausted,
  PAYMENT_POLL_MAX_ATTEMPTS,
  paymentPollDelayMs,
} from "@/lib/checkout/payment-poll";

/**
 * While payment is still pending after MoMo approval, keep asking the server
 * to reconcile this order's unique payment reference with Moolre.
 * Clears purchased bag items as soon as payment is confirmed.
 *
 * Polling is finite (~6 minutes). After exhaustion, the customer can manually
 * check again / restart a bounded poll window so delayed PAID confirmation
 * can still refresh the page and allow Purchase analytics to fire.
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
  const [manualBusy, setManualBusy] = React.useState(false);
  const clearedRef = React.useRef(false);

  const applyPaid = React.useCallback(() => {
    if (!clearedRef.current) {
      clearedRef.current = true;
      clearPurchasedAfterPayment();
    }
    router.refresh();
  }, [clearPurchasedAfterPayment, router]);

  const checkPaymentOnce = React.useCallback(async (): Promise<boolean> => {
    const url = `/api/checkout/payment-status?order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const json = (await res.json()) as { paid?: boolean };
    return Boolean(json.paid);
  }, [orderId, token]);

  React.useEffect(() => {
    if (!enabled || !orderId || !token) return;
    if (isPaymentPollExhausted(attempts)) return;

    const timer = window.setTimeout(async () => {
      try {
        if (await checkPaymentOnce()) {
          applyPaid();
          return;
        }
      } catch {
        // keep polling
      }
      setAttempts((n) => n + 1);
    }, paymentPollDelayMs(attempts));

    return () => window.clearTimeout(timer);
  }, [enabled, orderId, token, attempts, checkPaymentOnce, applyPaid]);

  const onCheckAgain = React.useCallback(async () => {
    if (manualBusy) return;
    setManualBusy(true);
    try {
      if (await checkPaymentOnce()) {
        applyPaid();
        return;
      }
      // Restart a bounded auto-poll window without polling forever.
      setAttempts(0);
    } catch {
      setAttempts(0);
    } finally {
      setManualBusy(false);
    }
  }, [manualBusy, checkPaymentOnce, applyPaid]);

  if (!enabled) return null;

  const exhausted = isPaymentPollExhausted(attempts);

  if (exhausted) {
    return (
      <div className="mx-auto mt-3 max-w-md space-y-2">
        <p className="text-xs text-muted-foreground">
          Payment is still being confirmed. If you already approved MoMo, check again —
          this page will update when payment is received.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={manualBusy}
          onClick={() => void onCheckAgain()}
        >
          {manualBusy ? "Checking…" : "Check payment status"}
        </Button>
      </div>
    );
  }

  return (
    <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
      Checking payment status
      {attempts > 0 ? `… (${attempts}/${PAYMENT_POLL_MAX_ATTEMPTS})` : "…"}
    </p>
  );
}
