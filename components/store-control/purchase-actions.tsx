"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/components/providers/cart-provider";
import { useStoreControl } from "@/components/store-control/store-control-provider";

type CartPayload = Parameters<ReturnType<typeof useCart>["addItem"]>[0];

export function PurchaseActions({
  productSlug,
  cartPayload,
  className,
}: {
  productSlug: string;
  cartPayload: CartPayload;
  className?: string;
}) {
  const control = useStoreControl();
  const { addItem, openCart } = useCart();
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function joinWaitlist() {
    if (!email.trim()) {
      setError("Enter your email to join the waitlist.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: `presale:${productSlug}`.slice(0, 64),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not join waitlist.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (control.checkoutAllowed) {
    return (
      <div className={className}>
        <Button
          type="button"
          size="sm"
          className="h-10 min-h-10 w-full gap-2 bg-black text-[11px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] hover:bg-black/90 sm:h-9 sm:min-h-9"
          onClick={() => {
            addItem(cartPayload);
            openCart();
          }}
        >
          <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
          Add to cart
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-2 h-10 min-h-10 w-full border-black/20 text-[11px] font-medium sm:h-9 sm:min-h-9"
        >
          <Link href={`/product/${productSlug}`}>Buy now</Link>
        </Button>
      </div>
    );
  }

  if (sent) {
    return (
      <p className={`text-center text-xs text-emerald-800 ${className ?? ""}`}>
        You&apos;re on the list — we&apos;ll notify you at launch.
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-10 rounded-full border-border bg-background px-4 text-sm"
      />
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <Button
        type="button"
        disabled={busy}
        className="h-10 w-full rounded-full bg-black text-[11px] font-semibold text-white"
        onClick={() => void joinWaitlist()}
      >
        {busy ? "Joining…" : control.presaleCtaLabel}
      </Button>
    </div>
  );
}
