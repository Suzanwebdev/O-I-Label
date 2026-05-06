import { getNewsletterCountry } from "@/lib/newsletter-country-codes";

export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Concatenate ITU dial (e.g. "+233") and local digits → E.164-style digits-only (no "+" stored).
 */
export function buildNewsletterPhoneE164(dial: string, phoneLocal: string): string | null {
  const dialDigits = dial.replace(/\D/g, "");
  let localDigits = phoneLocal.replace(/\D/g, "");
  if (!dialDigits || localDigits.length < 6) return null;
  if (localDigits.startsWith("0")) {
    localDigits = localDigits.slice(1);
  }
  if (!localDigits.length) return null;
  return `${dialDigits}${localDigits}`;
}

export function resolveNewsletterPhone(
  countryIso: string,
  phoneLocal: string
): { phoneE164: string; country: string } | { error: string } {
  const country = getNewsletterCountry(countryIso);
  if (!country) {
    return { error: "Invalid country" };
  }
  const phoneE164 = buildNewsletterPhoneE164(country.dial, phoneLocal);
  if (!phoneE164) {
    return { error: "Enter a valid phone number" };
  }
  return { phoneE164, country: country.iso };
}
