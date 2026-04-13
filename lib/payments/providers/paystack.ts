import crypto from "crypto";
import type { InitiatePaymentInput, InitiatePaymentResult, WebhookParseResult } from "../types";

export async function initiatePaystack(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not set");
  }
  const reference = `paystack_${input.orderId}_${Date.now()}`;
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountGhs * 100),
      reference,
      callback_url: input.callbackUrl,
      metadata: { order_id: input.orderId, ...input.metadata },
    }),
  });
  const json = (await res.json()) as {
    status: boolean;
    data?: { authorization_url: string; reference: string };
    message?: string;
  };
  if (!json.status || !json.data?.authorization_url) {
    throw new Error(json.message ?? "Paystack initialize failed");
  }
  return {
    provider: "paystack",
    reference: json.data.reference,
    redirectUrl: json.data.authorization_url,
    raw: json,
  };
}

export function verifyPaystackSignature(
  body: string,
  signature: string | null
): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");
  return hash === signature;
}

export function parsePaystackWebhook(body: unknown): WebhookParseResult {
  const evt = body as {
    event?: string;
    data?: { reference?: string; metadata?: { order_id?: string }; amount?: number };
  };
  const d = evt.data;
  return {
    reference: d?.reference ?? "",
    orderId: d?.metadata?.order_id,
    amountGhs: d?.amount != null ? d.amount / 100 : undefined,
    success: evt.event === "charge.success",
    raw: body,
  };
}
