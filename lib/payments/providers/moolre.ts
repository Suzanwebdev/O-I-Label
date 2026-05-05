import crypto from "crypto";
import type { InitiatePaymentInput, InitiatePaymentResult, WebhookParseResult } from "../types";

const MOOLRE_LINK_URL = "https://api.moolre.com/embed/link";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`${name} is not set`);
  return v.trim();
}

function appBaseUrl(): string {
  const base = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!base) throw new Error("APP_BASE_URL or NEXT_PUBLIC_SITE_URL is required for Moolre redirects");
  return base.replace(/\/$/, "");
}

/** Server callback URL to pass as `callback` when generating a Moolre payment link. */
export function resolveMoolreCallbackUrl(): string {
  return `${appBaseUrl()}/api/webhooks/moolre`;
}

type MoolreLinkSuccess = {
  status: number;
  code?: string;
  message?: string;
  data?: { authorization_url?: string; reference?: string };
};

/**
 * Generate a Moolre Web POS payment link (POST /embed/link).
 *
 * Env: `MOOLRE_API_USER`, `MOOLRE_API_PUBKEY`, `MOOLRE_ACCOUNT_NUMBER`, `MOOLRE_BUSINESS_EMAIL`
 * (business email per Moolre docs). Optional: `MOOLRE_REUSABLE` (`0` | `1`), `MOOLRE_WEBHOOK_SECRET`
 * (if set, webhook route must send the same value in header `x-moolre-callback-secret`).
 */
export async function initiateMoolre(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  const apiUser = requireEnv("MOOLRE_API_USER");
  const apiPubKey = requireEnv("MOOLRE_API_PUBKEY");
  const accountNumber = requireEnv("MOOLRE_ACCOUNT_NUMBER");
  const businessEmail = requireEnv("MOOLRE_BUSINESS_EMAIL");

  const base = appBaseUrl();
  const redirect = input.redirectUrl?.trim() || `${base}/account/orders?payment=success`;

  const externalref = `oi_${input.orderId}_${Date.now()}`;
  const reusable = (process.env.MOOLRE_REUSABLE?.trim() || "0") === "1" ? "1" : "0";

  const amountStr = Number.isFinite(input.amountGhs)
    ? input.amountGhs.toFixed(2)
    : String(input.amountGhs);

  const metadata: Record<string, string> = {
    order_id: input.orderId,
    customer_email: input.email,
    ...(input.metadata ?? {}),
  };

  const res = await fetch(MOOLRE_LINK_URL, {
    method: "POST",
    headers: {
      "X-API-USER": apiUser,
      "X-API-PUBKEY": apiPubKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: 1,
      amount: amountStr,
      email: businessEmail,
      externalref,
      callback: input.callbackUrl,
      redirect,
      reusable,
      currency: "GHS",
      accountnumber: accountNumber,
      metadata,
    }),
  });

  const json = (await res.json()) as MoolreLinkSuccess & { message?: string };

  if (!res.ok || json.status !== 1 || !json.data?.authorization_url || !json.data?.reference) {
    const msg = json.message || `Moolre link failed (${res.status})`;
    throw new Error(msg);
  }

  return {
    provider: "moolre",
    reference: json.data.reference,
    redirectUrl: json.data.authorization_url,
    raw: json,
  };
}

export function verifyMoolreWebhookSignature(_payload: string, headerSecret: string | null): boolean {
  const expected = process.env.MOOLRE_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  if (!headerSecret) return false;
  const a = Buffer.from(headerSecret);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Parse Moolre payment webhook/callback JSON (status 1 = success). */
export function parseMoolreWebhook(body: unknown): WebhookParseResult {
  const b = body as {
    status?: number;
    code?: string;
    data?: {
      reference?: string;
      externalref?: string;
      amount?: string | number;
      metadata?: Record<string, unknown>;
    };
    reference?: string;
  };
  const data = b.data ?? {};
  const reference = String(data.reference ?? data.externalref ?? b.reference ?? "").trim();
  const success = b.status === 1;
  const amountRaw = data.amount;
  let amountGhs: number | undefined;
  if (amountRaw != null) {
    const n = typeof amountRaw === "number" ? amountRaw : Number.parseFloat(String(amountRaw));
    if (!Number.isNaN(n)) amountGhs = n;
  }
  const meta = data.metadata;
  const orderId =
    meta && typeof meta.order_id === "string"
      ? meta.order_id
      : meta && typeof meta.order_id === "number"
        ? String(meta.order_id)
        : undefined;

  return {
    reference,
    orderId,
    amountGhs,
    success,
    raw: body,
  };
}
