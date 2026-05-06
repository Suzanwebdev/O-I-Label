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

export function buildOrderStatusSmsBody(args: {
  orderNumber: string;
  status: string;
  trackingNumber?: string | null;
}): string {
  const n = args.orderNumber;
  switch (args.status) {
    case "paid":
      return `O&I Label: We received your payment for order ${n}. Thank you!`;
    case "processing":
      return `O&I Label: Order ${n} is being prepared. We'll notify you when it ships.`;
    case "shipped": {
      const t = args.trackingNumber?.trim();
      return t
        ? `O&I Label: Order ${n} has shipped. Tracking: ${t}`
        : `O&I Label: Order ${n} has shipped. Check your email for details.`;
    }
    case "delivered":
      return `O&I Label: Order ${n} is delivered. Thank you for shopping with us!`;
    default:
      return `O&I Label: Order ${n} update: ${args.status}.`;
  }
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

  const vas = process.env.MOOLRE_SMS_VASKEY?.trim();
  const sender = process.env.MOOLRE_SMS_SENDER_ID?.trim();
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
