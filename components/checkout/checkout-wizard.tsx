"use client";

import * as React from "react";
import Link from "next/link";
import { useCart } from "@/components/providers/cart-provider";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Price } from "@/components/store/price";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const steps = ["Details", "Shipping", "Payment", "Review"] as const;

type AppliedPromo = {
  code: string;
  label: string;
  discountGhs: number;
};

export function CheckoutWizard() {
  const { selectedLines, subtotalGhs, isExpressCheckout } = useCart();
  const [step, setStep] = React.useState(0);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [promoInput, setPromoInput] = React.useState("");
  const [appliedPromo, setAppliedPromo] = React.useState<AppliedPromo | null>(null);
  const [promoBusy, setPromoBusy] = React.useState(false);
  const [promoError, setPromoError] = React.useState<string | null>(null);

  const shippingGhs = 0;
  const discountGhs = appliedPromo?.discountGhs ?? 0;
  const totalGhs = Math.max(0, subtotalGhs + shippingGhs - discountGhs);

  if (selectedLines.length === 0) {
    return (
      <Container className="py-16 text-center">
        <p className="text-muted-foreground">
          {isExpressCheckout ? (
            <>
              Your buy-now session expired.{" "}
              <Link href="/shop" className="text-navy underline">
                Return to shop
              </Link>
            </>
          ) : (
            <>
              No items selected for checkout.{" "}
              <Link href="/cart" className="text-navy underline">
                Return to your bag
              </Link>{" "}
              and choose the products you want to buy.
            </>
          )}
        </p>
      </Container>
    );
  }

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function applyPromoCode() {
    const code = promoInput.trim();
    if (!code) {
      setPromoError("Enter a promo code");
      return;
    }
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/checkout/validate-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalGhs, shippingGhs }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        label?: string;
        discountGhs?: number;
      };
      if (!res.ok || !json.ok) {
        setAppliedPromo(null);
        setPromoError(json.error ?? "Could not apply promo code");
        return;
      }
      setAppliedPromo({
        code: json.code ?? code.toUpperCase(),
        label: json.label ?? "Discount applied",
        discountGhs: Number(json.discountGhs ?? 0),
      });
      setPromoInput(json.code ?? code.toUpperCase());
    } catch {
      setPromoError("Network error. Try again.");
    } finally {
      setPromoBusy(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
  }

  async function placeOrder() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          address,
          city,
          region,
          lines: selectedLines.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
            name: line.name,
          })),
          ...(appliedPromo ? { discountCode: appliedPromo.code } : {}),
        }),
      });
      const json = (await res.json()) as {
        redirectUrl?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const msg = json.detail ? `${json.error ?? "Checkout failed"}. ${json.detail}` : json.error;
        setError(msg ?? "Could not initialize payment. Please try again.");
        return;
      }
      if (json.redirectUrl) {
        window.location.href = json.redirectUrl;
        return;
      }
      setError("Payment link was not returned. Please try again.");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="py-10 md:py-14">
      <Heading as="h1" eyebrow="Checkout">
        Complete your order
      </Heading>
      <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {steps.map((s, i) => (
          <span
            key={s}
            className={
              i === step ? "text-navy" : i < step ? "text-foreground" : ""
            }
          >
            {i + 1}. {s}
            {i < steps.length - 1 ? " · " : ""}
          </span>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Contact details for order updates.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first">First name</Label>
                  <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last">Last name</Label>
                  <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Where should we deliver?
              </p>
              <div className="space-y-2">
                <Label htmlFor="addr">Address</Label>
                <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} required />
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pay securely on-site. Moolre is the default when enabled in
                settings; Paystack and Flutterwave can be toggled by the store.
              </p>
              <Tabs defaultValue="moolre">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="moolre">Moolre</TabsTrigger>
                  <TabsTrigger value="paystack">Paystack</TabsTrigger>
                  <TabsTrigger value="flutterwave">Flutterwave</TabsTrigger>
                </TabsList>
                <TabsContent value="moolre" className="mt-4 text-sm text-muted-foreground">
                  You will be redirected to complete payment. Webhook confirms
                  order automatically.
                </TabsContent>
                <TabsContent value="paystack" className="mt-4 text-sm text-muted-foreground">
                  Card and mobile money where available.
                </TabsContent>
                <TabsContent value="flutterwave" className="mt-4 text-sm text-muted-foreground">
                  Pan-African cards and wallets.
                </TabsContent>
              </Tabs>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 text-sm">
              <p>
                Review your selected products and total, then continue to secure payment.
              </p>
              <ul className="space-y-2">
                {selectedLines.map((l) => (
                  <li key={l.variantId} className="flex justify-between">
                    <span>
                      {l.name} × {l.quantity}
                    </span>
                    <Price amountGhs={l.unitPriceGhs * l.quantity} />
                  </li>
                ))}
              </ul>
              {appliedPromo ? (
                <p className="text-sm text-emerald-700">
                  Promo <span className="font-medium">{appliedPromo.code}</span> — {appliedPromo.label}
                </p>
              ) : null}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={back}>
                Back
              </Button>
            ) : null}
            {step < steps.length - 1 ? (
              <Button type="button" onClick={next}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={placeOrder} disabled={submitting}>
                {submitting ? "Redirecting..." : "Proceed to payment"}
              </Button>
            )}
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>

        <aside className="h-fit space-y-4 rounded-[var(--radius-lg)] border border-border bg-muted/40 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Summary
          </p>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="promo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Promo code
            </Label>
            {appliedPromo ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{appliedPromo.code}</p>
                  <p className="text-xs text-muted-foreground">{appliedPromo.label}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={removePromo}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="promo"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value);
                    setPromoError(null);
                  }}
                  placeholder="Enter code"
                  className="h-10 uppercase"
                  autoCapitalize="characters"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void applyPromoCode();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0"
                  disabled={promoBusy}
                  onClick={() => void applyPromoCode()}
                >
                  {promoBusy ? "..." : "Apply"}
                </Button>
              </div>
            )}
            {promoError ? <p className="text-xs text-destructive">{promoError}</p> : null}
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <Price amountGhs={subtotalGhs} />
          </div>
          {appliedPromo && discountGhs > 0 ? (
            <div className="flex justify-between text-sm text-emerald-800">
              <span>Discount</span>
              <Price amountGhs={discountGhs} className="text-emerald-800" />
            </div>
          ) : appliedPromo ? (
            <p className="text-xs text-emerald-700">{appliedPromo.label}</p>
          ) : null}
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
            <span>Total</span>
            <Price amountGhs={totalGhs} />
          </div>
          <p className="text-xs text-muted-foreground">Shipping is included where applicable. Tax at GH₵ 0.</p>
        </aside>
      </div>
    </Container>
  );
}
