import { createHash } from "node:crypto";

/** Hashed Meta Conversions API customer identifiers (never raw PII). */
export type MetaCapiUserData = {
  em?: string[];
  ph?: string[];
};

/** Meta: trim + lowercase before hashing email. */
export function normalizeEmailForMeta(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return email;
}

/**
 * Meta phone: digits only with country code.
 * Ghana-aware mapping aligned with store SMS normalization (233…).
 */
export function normalizePhoneForMeta(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  if (digits.length >= 12) return digits;
  return null;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Build Meta CAPI user_data with only successfully normalized + hashed em/ph.
 * Returns null when neither identifier can be hashed.
 */
export function buildMetaCapiUserData(input: {
  email?: string | null;
  phone?: string | null;
}): MetaCapiUserData | null {
  const userData: MetaCapiUserData = {};

  const email = normalizeEmailForMeta(input.email);
  if (email) userData.em = [sha256Hex(email)];

  const phone = normalizePhoneForMeta(input.phone);
  if (phone) userData.ph = [sha256Hex(phone)];

  if (!userData.em && !userData.ph) return null;
  return userData;
}
