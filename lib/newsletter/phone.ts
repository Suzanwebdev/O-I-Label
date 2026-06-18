export function formatNewsletterPhone(phoneE164: string | null | undefined): string {
  const digits = phoneE164?.replace(/\D/g, "") ?? "";
  if (!digits) return "—";
  return `+${digits}`;
}
