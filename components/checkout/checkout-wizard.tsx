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
import { Smartphone } from "lucide-react";
import { MomoNetworkLogos } from "@/components/checkout/momo-network-logos";

type AppliedPromo = {
  code: string;
  label: string;
  discountGhs: number;
};

type FieldErrors = Partial<
  Record<"firstName" | "lastName" | "email" | "phone" | "address" | "city" | "region", string>
>;

function sectionTitle(title: string, hint: string) {
  return (
    <div className="space-y-1">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export function CheckoutWizard() {
  const { selectedLines, subtotalGhs, isExpressCheckout } = useCart();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [promoInput, setPromoInput] = React.useState("");
  const [appliedPromo, setAppliedPromo] = React.useState<AppliedPromo | null>(null);
  const [promoBusy, setPromoBusy] = React.useState(false);
  const [promoError, setPromoError] = React.useState<string | null>(null);

  const formTopRef = React.useRef<HTMLDivElement>(null);

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

  function validateFields(): FieldErrors {
    const next: FieldErrors = {};
    if (!firstName.trim()) next.firstName = "Enter your first name";
    if (!lastName.trim()) next.lastName = "Enter your last name";
    if (!email.trim()) next.email = "Enter your email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email";
    if (!phone.trim()) next.phone = "Enter your phone number";
    if (!address.trim()) next.address = "Enter your delivery address";
    if (!city.trim()) next.city = "Enter your city";
    if (!region.trim()) next.region = "Enter your region";
    return next;
  }

  async function placeOrder() {
    if (submitting) return;
    setError(null);
    const errors = validateFields();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please complete the highlighted fields.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

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

  function fieldClass(key: keyof FieldErrors) {
    return fieldErrors[key] ? "border-destructive" : undefined;
  }

  return (
    <Container className="py-10 md:py-14">
      <Heading as="h1" eyebrow="Checkout">
        Complete your order
      </Heading>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div
          ref={formTopRef}
          className="space-y-8 rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8"
        >
          <section className="space-y-4">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Contact details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input
                  id="first"
                  value={firstName}
                  className={fieldClass("firstName")}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                  autoComplete="given-name"
                />
                {fieldErrors.firstName ? (
                  <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input
                  id="last"
                  value={lastName}
                  className={fieldClass("lastName")}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                  }}
                  autoComplete="family-name"
                />
                {fieldErrors.lastName ? (
                  <p className="text-xs text-destructive">{fieldErrors.lastName}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                className={fieldClass("email")}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                autoComplete="email"
                required
              />
              {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                className={fieldClass("phone")}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                autoComplete="tel"
                required
              />
              {fieldErrors.phone ? <p className="text-xs text-destructive">{fieldErrors.phone}</p> : null}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            {sectionTitle("Delivery", "Where should we deliver?")}
            <div className="space-y-2">
              <Label htmlFor="addr">Address</Label>
              <Input
                id="addr"
                value={address}
                className={fieldClass("address")}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, address: undefined }));
                }}
                autoComplete="street-address"
                required
              />
              {fieldErrors.address ? (
                <p className="text-xs text-destructive">{fieldErrors.address}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  className={fieldClass("city")}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, city: undefined }));
                  }}
                  autoComplete="address-level2"
                  required
                />
                {fieldErrors.city ? <p className="text-xs text-destructive">{fieldErrors.city}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={region}
                  className={fieldClass("region")}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, region: undefined }));
                  }}
                  autoComplete="address-level1"
                  required
                />
                {fieldErrors.region ? (
                  <p className="text-xs text-destructive">{fieldErrors.region}</p>
                ) : null}
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Payment</h2>
            <div role="radiogroup" aria-label="Payment method" className="space-y-3">
              <div
                role="radio"
                aria-checked="true"
                tabIndex={0}
                className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-foreground/20 bg-background p-4 shadow-[var(--shadow-soft)] ring-1 ring-foreground/5"
              >
                <span
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"
                  aria-hidden
                >
                  <Smartphone className="h-5 w-5 text-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pr-1">
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                      Mobile Money
                    </span>
                    <MomoNetworkLogos />
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    Pay securely with your Mobile Money account.
                  </span>
                </span>
                <span
                  className="mt-1 h-4 w-4 shrink-0 rounded-full border border-foreground bg-foreground shadow-[inset_0_0_0_3px_hsl(var(--background))]"
                  aria-hidden
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            {sectionTitle("Your items", "Confirm what’s in this order.")}
            <ul className="space-y-2 text-sm">
              {selectedLines.map((l) => (
                <li key={l.variantId} className="flex justify-between gap-3">
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
          </section>

          <div className="pt-2">
            <Button type="button" className="w-full sm:w-auto" onClick={placeOrder} disabled={submitting}>
              {submitting ? "Redirecting..." : "Proceed to payment"}
            </Button>
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-[var(--radius-lg)] border border-border bg-muted/40 p-6 lg:sticky lg:top-24">
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
          <Button
            type="button"
            className="hidden w-full lg:inline-flex"
            onClick={placeOrder}
            disabled={submitting}
          >
            {submitting ? "Redirecting..." : "Proceed to payment"}
          </Button>
        </aside>
      </div>
    </Container>
  );
}
