import { sendMoolreSms } from "@/lib/sms/moolre";

/** Digits-only international format for Ghana-focused store (e.g. 23324XXXXXXX). */
export function normalizeSmsRecipient(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  if (digits.length >= 12) return digits;
  return null;
}

/** Moolre SMS API limit (characters per message). */
export const MOOLRE_SMS_CHAR_LIMIT = 160;

/** First token of a full name for SMS greetings. */
export function smsGreetingName(fullName?: string | null): string | null {
  const first = fullName?.trim().split(/\s+/).filter(Boolean)[0];
  return first || null;
}

/**
 * Optional personal greeting before the SMS body.
 * Brand is omitted — the SMS sender ID already identifies O & I Label.
 * Example prefix: "Hi Ama, "
 */
export function brandedSmsPrefix(fullName?: string | null): string {
  const name = smsGreetingName(fullName);
  return name ? `Hi ${name}, ` : "";
}

/** Full SMS length including greeting prefix (before any truncate). */
export function brandedSmsLength(message: string, fullName?: string | null): number {
  return brandedSmsPrefix(fullName).length + message.trim().length;
}

/**
 * Optional personal greeting + message body.
 * Example: "Hi Ama, We received your payment..."
 */
export function formatBrandedSms(message: string, fullName?: string | null): string {
  const text = `${brandedSmsPrefix(fullName)}${message.trim()}`;
  return text.slice(0, MOOLRE_SMS_CHAR_LIMIT);
}

export function buildOrderStatusSmsBody(args: {
  orderNumber: string;
  status: string;
  trackingNumber?: string | null;
  firstName?: string | null;
}): string {
  const n = args.orderNumber;
  let body: string;
  switch (args.status) {
    case "paid":
      body = `We received your payment for order ${n}. Thank you!`;
      break;
    case "processing":
      body = `Order ${n} is being prepared. We'll notify you when it ships.`;
      break;
    case "shipped": {
      const t = args.trackingNumber?.trim();
      body = t
        ? `Order ${n} has shipped. Tracking: ${t}`
        : `Order ${n} has shipped. Check your email for details.`;
      break;
    }
    case "delivered":
      body = `Order ${n} is delivered. Thank you for shopping with us!`;
      break;
    default:
      body = `Order ${n} update: ${args.status}.`;
      break;
  }
  return formatBrandedSms(body, args.firstName);
}

export type OrderSmsNotifyResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; reason: string }
  | { ok: false; error: string };

/**
 * Sends one SMS via Moolre when VAS key + sender ID are set.
 * Uses env MOOLRE_SMS_ORDER_NOTIFICATIONS — unset or "1" enables; "0" disables.
 */
export async function trySendOrderSms(args: {
  recipient: string;
  message: string;
  ref: string;
}): Promise<OrderSmsNotifyResult> {
  const enabled = process.env.MOOLRE_SMS_ORDER_NOTIFICATIONS?.trim();
  if (enabled === "0") {
    return { ok: true, sent: false, reason: "disabled_by_env" };
  }

  const vas =
    process.env.MOOLRE_SMS_VASKEY?.trim() || process.env.MOOLRE_SMS_API_KEY?.trim();
  const sender =
    process.env.MOOLRE_SMS_SENDER_ID?.trim() || process.env.SMS_SENDER_ID?.trim();
  if (!vas || !sender) {
    return { ok: true, sent: false, reason: "sms_not_configured" };
  }

  try {
    await sendMoolreSms({
      senderid: sender,
      messages: [{ recipient: args.recipient, message: args.message, ref: args.ref }],
    });
    return { ok: true, sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sms_failed";
    return { ok: false, error: msg };
  }
}
