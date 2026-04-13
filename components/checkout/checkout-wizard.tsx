"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { lines, subtotalGhs, clear } = useCart();
  const [step, setStep] = React.useState(0);
  const flags = mergeFeatureFlags();

  if (lines.length === 0) {
    return (
      <Container className="py-16 text-center">
        <p className="text-muted-foreground">
          Your bag is empty.{" "}
          <Link href="/shop" className="text-navy underline">
            Shop pieces
          </Link>
        </p>
      </Container>
    );
  }

  function next() {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function placeDemoOrder() {
    clear();
    router.push("/checkout/success?demo=1");
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
                  <Input id="first" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last">Last name</Label>
                  <Input id="last" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" />
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
                <Input id="addr" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" />
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
                Review your bag and total. Placing the order will connect to live
                payment APIs once configured (Phase 5).
              </p>
              <ul className="space-y-2">
                {lines.map((l) => (
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
              <Button type="button" onClick={placeDemoOrder}>
                Place order (demo)
              </Button>
            )}
          </div>
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
