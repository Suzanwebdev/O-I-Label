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
import { mergeFeatureFlags } from "@/lib/feature-flags";

const steps = ["Details", "Shipping", "Payment", "Review"] as const;

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
  const flags = mergeFeatureFlags();

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
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <Price amountGhs={subtotalGhs} />
          </div>
          <p className="text-xs text-muted-foreground">
            Feature flags: reviews {flags.reviews ? "on" : "off"} · loyalty{" "}
            {flags.loyalty ? "on" : "off"}
          </p>
        </aside>
      </div>
    </Container>
  );
}
