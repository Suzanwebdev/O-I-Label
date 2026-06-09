"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  NEWSLETTER_COUNTRY_DIAL_CODES,
  NEWSLETTER_DEFAULT_COUNTRY_ISO,
  getNewsletterCountry,
} from "@/lib/newsletter-country-codes";

export function VipWaitlistForm({
  source = "presale",
  productSlug,
  ctaLabel = "Join the private list",
  compact,
  className,
  onSuccess,
}: {
  source?: string;
  productSlug?: string | null;
  ctaLabel?: string;
  compact?: boolean;
  className?: string;
  onSuccess?: () => void;
}) {
  const [firstName, setFirstName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [countryIso, setCountryIso] = React.useState(NEWSLETTER_DEFAULT_COUNTRY_ISO);
  const [phoneLocal, setPhoneLocal] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedCountry = React.useMemo(
    () => getNewsletterCountry(countryIso) ?? getNewsletterCountry(NEWSLETTER_DEFAULT_COUNTRY_ISO)!,
    [countryIso]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/store-control/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim(),
          phoneLocal: phoneLocal.trim(),
          countryIso,
          source,
          productSlug: productSlug ?? undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not join the list.");
        return;
      }
      setSent(true);
      onSuccess?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className={cn("text-center text-sm leading-relaxed text-emerald-900", className)}>
        You&apos;re on the private list — we&apos;ll be in touch before launch.
      </p>
    );
  }

  const labelClass = compact
    ? "text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
    : "text-xs text-muted-foreground";
  const inputClass = cn(
    compact ? "h-10 rounded-full text-sm" : "h-11 rounded-full",
    "border-border bg-white px-4 shadow-none"
  );

  return (
    <form onSubmit={onSubmit} className={cn("space-y-3 text-left", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="vip-first-name" className={labelClass}>
          First name
        </Label>
        <Input
          id="vip-first-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Your first name"
          className={inputClass}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vip-email" className={labelClass}>
          Email
        </Label>
        <Input
          id="vip-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className={inputClass}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Phone / WhatsApp</Label>
        <div className="flex gap-2">
          <Select value={countryIso} onValueChange={setCountryIso}>
            <SelectTrigger className={cn(inputClass, "w-[108px] shrink-0 px-2")}>
              <SelectValue>{selectedCountry.dial}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {NEWSLETTER_COUNTRY_DIAL_CODES.map((c) => (
                <SelectItem key={c.iso} value={c.iso}>
                  {c.name} ({c.dial})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="tel"
            value={phoneLocal}
            onChange={(e) => setPhoneLocal(e.target.value)}
            placeholder="Mobile number"
            className={cn(inputClass, "flex-1")}
          />
        </div>
      </div>
      {error ? <p className="text-center text-xs text-red-700">{error}</p> : null}
      <Button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-full bg-black text-[12px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-black/90"
      >
        {busy ? "Joining…" : ctaLabel}
      </Button>
    </form>
  );
}
