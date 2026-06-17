type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 60;
const WINDOW_MS = 60_000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

/** Simple in-memory rate limiter (per server instance). */
export function checkRateLimit(
  request: Request,
  routeKey: string,
  limit = DEFAULT_LIMIT
): RateLimitResult {
  const key = `${clientIp(request)}:${routeKey}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSec),
    },
  });
}

export async function enforceRateLimit(
  request: Request,
  routeKey: string,
  limit?: number
): Promise<Response | null> {
  const result = checkRateLimit(request, routeKey, limit);
  if (!result.ok) return rateLimitResponse(result.retryAfterSec);
  return null;
}
