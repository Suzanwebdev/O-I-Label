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

export function HomeNewsletter({
  compact,
  refined,
}: {
  compact?: boolean;
  /** Tighter, quieter chrome for footer (use with compact). */
  refined?: boolean;
}) {
  const [email, setEmail] = React.useState("");
  const [countryIso, setCountryIso] = React.useState(NEWSLETTER_DEFAULT_COUNTRY_ISO);
  const [phoneLocal, setPhoneLocal] = React.useState("");
  const [sent, setSent] = React.useState(false);

  const selectedCountry = React.useMemo(
    () => getNewsletterCountry(countryIso) ?? getNewsletterCountry(NEWSLETTER_DEFAULT_COUNTRY_ISO)!,
    [countryIso]
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  const labelClass =
    compact && refined
      ? "text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
      : compact
        ? "text-[11px] font-normal text-muted-foreground"
        : "text-xs text-muted-foreground";
  const inputClass = cn(
    compact ? "h-9 text-sm" : "h-12",
    refined &&
      "border-foreground/10 bg-white shadow-none transition-colors focus-visible:border-foreground/25"
  );

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex w-full flex-col",
        compact ? "max-w-none gap-3" : "max-w-md gap-4"
      )}
    >
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <Label htmlFor="newsletter-email" className={labelClass}>
          Email
        </Label>
        <Input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <Label htmlFor="newsletter-phone-local" className={labelClass}>
          Phone / WhatsApp
        </Label>
        <div className="flex gap-2">
          <Select value={countryIso} onValueChange={setCountryIso}>
            <SelectTrigger
              aria-label="Country calling code"
              title={`${selectedCountry.name} (${selectedCountry.dial})`}
              className={cn(
                inputClass,
                "w-[min(11rem,42%)] shrink-0 px-2 text-left text-xs sm:w-[7.5rem] sm:px-3 sm:text-sm",
                !compact && "sm:w-[8.5rem]",
                refined && "text-muted-foreground"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72 w-[min(calc(100vw-2rem),18rem)]">
              {NEWSLETTER_COUNTRY_DIAL_CODES.map((c) => (
                <SelectItem key={c.iso} value={c.iso} className="text-sm">
                  {c.name} ({c.dial})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="newsletter-phone-local"
            type="tel"
            required
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="Phone number"
            value={phoneLocal}
            onChange={(e) => setPhoneLocal(e.target.value)}
            className={cn(inputClass, "min-w-0 flex-1")}
          />
        </div>
      </div>
      <Button
        type="submit"
        variant={refined ? "outline" : "default"}
        size={compact ? "sm" : "lg"}
        className={
          compact
            ? refined
              ? "w-full border-foreground/15 bg-transparent text-xs text-foreground hover:bg-foreground hover:text-background sm:w-auto sm:self-start"
              : "w-full text-xs sm:w-auto sm:self-start"
            : "h-12 w-full sm:w-auto sm:self-start sm:px-8"
        }
      >
        {sent ? "You are in" : "Subscribe"}
      </Button>
    </form>
  );
}
