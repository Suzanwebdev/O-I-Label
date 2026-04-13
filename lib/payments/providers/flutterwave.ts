import crypto from "crypto";
import type { InitiatePaymentInput, InitiatePaymentResult, WebhookParseResult } from "../types";

export async function initiateFlutterwave(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) {
    throw new Error("FLUTTERWAVE_SECRET_KEY is not set");
  }
  const txRef = `flw_${input.orderId}_${Date.now()}`;
  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount: input.amountGhs,
      currency: "GHS",
      redirect_url: input.callbackUrl,
      customer: { email: input.email },
      meta: { order_id: input.orderId, ...input.metadata },
    }),
  });
  const json = (await res.json()) as {
    status: string;
    data?: { link?: string };
    message?: string;
  };
  if (json.status !== "success" || !json.data?.link) {
    throw new Error(json.message ?? "Flutterwave initialize failed");
  }
  return {
    provider: "flutterwave",
    reference: txRef,
    redirectUrl: json.data.link,
    raw: json,
  };
}

export function verifyFlutterwaveSignature(
  body: string,
  signature: string | null
): boolean {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secretHash || !signature) return false;
  const hash = crypto.createHmac("sha256", secretHash).update(body).digest("hex");
  return hash === signature;
}

export function parseFlutterwaveWebhook(body: unknown): WebhookParseResult {
  const b = body as {
    event?: string;
    data?: { tx_ref?: string; amount?: number; meta?: { order_id?: string } };
  };
  const d = b.data;
  return {
    reference: d?.tx_ref ?? "",
    orderId: d?.meta?.order_id,
    amountGhs: d?.amount,
    success: b.event === "charge.completed",
    raw: body,
  };
}
