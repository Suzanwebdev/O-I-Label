import type { InitiatePaymentInput, InitiatePaymentResult, WebhookParseResult } from "../types";

/**
 * Moolre (primary) — implement using official API docs when available.
 * TODO: Replace placeholders with real endpoints, signing, and verification.
 */
export async function initiateMoolre(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  const reference = `moolre_${input.orderId}_${Date.now()}`;
  return {
    provider: "moolre",
    reference,
    redirectUrl: `${process.env.APP_BASE_URL}/checkout/verifying?ref=${encodeURIComponent(reference)}`,
    raw: { status: "TODO_MOOLRE_INIT", input },
  };
}

export function verifyMoolreWebhookSignature(
  _payload: string,
  _signature: string | null
): boolean {
  // TODO: HMAC / public key verification per Moolre docs
  return true;
}

export function parseMoolreWebhook(body: unknown): WebhookParseResult {
  const raw = body as Record<string, unknown>;
  return {
    reference: String(raw.reference ?? raw.ref ?? ""),
    orderId: raw.orderId != null ? String(raw.orderId) : undefined,
    amountGhs: raw.amount != null ? Number(raw.amount) : undefined,
    success: raw.status === "success" || raw.success === true,
    raw,
  };
}
