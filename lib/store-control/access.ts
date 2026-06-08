import { createHash, timingSafeEqual } from "crypto";
import {
  STORE_ACCESS_COOKIE,
  STORE_ACCESS_COOKIE_MAX_AGE,
} from "@/lib/store-control/constants";

const PEPPER =
  process.env.STORE_ACCESS_PEPPER?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-32) ||
  "oi-label-store-access";

export function hashPrivateAccessPassword(password: string): string {
  return createHash("sha256").update(`${PEPPER}:${password}`).digest("hex");
}

export function verifyPrivateAccessPassword(
  password: string,
  storedHash: string | null | undefined
): boolean {
  if (!storedHash || !password) return false;
  const hash = hashPrivateAccessPassword(password);
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

export function normalizeAccessEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function privateAccessCookieValue(): string {
  return createHash("sha256")
    .update(`${PEPPER}:granted:${Date.now()}`)
    .digest("hex")
    .slice(0, 48);
}

export function storeAccessCookieHeader(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STORE_ACCESS_COOKIE}=${value}; Path=/; Max-Age=${STORE_ACCESS_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export function ipAllowed(client: string | null, allowed: string[] | null | undefined): boolean {
  if (!client || !allowed?.length) return false;
  return allowed.some((ip) => ip.trim() === client);
}
