import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentProviderId,
  WebhookParseResult,
} from "./types";
import { initiateMoolre, parseMoolreWebhook, verifyMoolreWebhookSignature } from "./providers/moolre";
import { initiatePaystack, parsePaystackWebhook, verifyPaystackSignature } from "./providers/paystack";
import {
  initiateFlutterwave,
  parseFlutterwaveWebhook,
  verifyFlutterwaveSignature,
} from "./providers/flutterwave";

export type { PaymentProviderId, InitiatePaymentInput, InitiatePaymentResult };

export function getDefaultProvider(
  prefs: {
    moolre?: boolean;
    paystack?: boolean;
    flutterwave?: boolean;
  } = {}
): PaymentProviderId {
  if (prefs.moolre !== false) return "moolre";
  if (prefs.paystack) return "paystack";
  return "flutterwave";
}

export async function initiatePayment(
  provider: PaymentProviderId,
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  switch (provider) {
    case "moolre":
      return initiateMoolre(input);
    case "paystack":
      return initiatePaystack(input);
    case "flutterwave":
      return initiateFlutterwave(input);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function verifyWebhook(
  provider: PaymentProviderId,
  rawBody: string,
  signature: string | null
): boolean {
  switch (provider) {
    case "moolre":
      return verifyMoolreWebhookSignature(rawBody, signature);
    case "paystack":
      return verifyPaystackSignature(rawBody, signature);
    case "flutterwave":
      return verifyFlutterwaveSignature(rawBody, signature);
    default:
      return false;
  }
}

export function parseWebhook(
  provider: PaymentProviderId,
  body: unknown
): WebhookParseResult {
  switch (provider) {
    case "moolre":
      return parseMoolreWebhook(body);
    case "paystack":
      return parsePaystackWebhook(body);
    case "flutterwave":
      return parseFlutterwaveWebhook(body);
    default:
      return { reference: "", success: false, raw: body };
  }
}
