import { createHmac, timingSafeEqual } from "crypto";

function signingSecret(envKey: string, fallbackEnvKeys: string[] = []): string {
  const primary = process.env[envKey]?.trim();
  if (primary) return primary;
  for (const key of fallbackEnvKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error(`${envKey} must be set in production`);
  }
  return "oi-label-dev-signing-secret";
}

function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifySignedToken(secret: string, token: string, parsePayload: (raw: string) => boolean): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return false;

  let payloadRaw: string;
  try {
    payloadRaw = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expected = signPayload(secret, payloadRaw);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  return parsePayload(payloadRaw);
}

/** HMAC-signed store private-access cookie: payload is expiry epoch ms. */
export function createStoreAccessToken(maxAgeSec: number): string {
  const secret = signingSecret("STORE_ACCESS_PEPPER", ["SUPABASE_SERVICE_ROLE_KEY"]);
  const exp = String(Date.now() + maxAgeSec * 1000);
  const sig = signPayload(secret, exp);
  const payloadB64 = Buffer.from(exp, "utf8").toString("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyStoreAccessToken(token: string, maxAgeSec: number): boolean {
  const secret = signingSecret("STORE_ACCESS_PEPPER", ["SUPABASE_SERVICE_ROLE_KEY"]);

  return verifySignedToken(secret, token, (raw) => {
    const exp = Number(raw);
    if (!Number.isFinite(exp)) return false;
    const now = Date.now();
    return exp > now && exp <= now + maxAgeSec * 1000 + 60_000;
  });
}

/** HMAC token granting read access to checkout success order summary. */
export function createOrderAccessToken(orderId: string, maxAgeSec = 60 * 60 * 24 * 7): string {
  const secret = signingSecret("ORDER_ACCESS_SECRET", ["STORE_ACCESS_PEPPER", "SUPABASE_SERVICE_ROLE_KEY"]);
  const exp = String(Date.now() + maxAgeSec * 1000);
  const payload = `${orderId}:${exp}`;
  const sig = signPayload(secret, payload);
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyOrderAccessToken(orderId: string, token: string, maxAgeSec = 60 * 60 * 24 * 7): boolean {
  const secret = signingSecret("ORDER_ACCESS_SECRET", ["STORE_ACCESS_PEPPER", "SUPABASE_SERVICE_ROLE_KEY"]);

  return verifySignedToken(secret, token, (raw) => {
    const [id, expRaw] = raw.split(":");
    const exp = Number(expRaw);
    if (id !== orderId || !Number.isFinite(exp)) return false;
    const now = Date.now();
    return exp > now && exp <= now + maxAgeSec * 1000 + 60_000;
  });
}
