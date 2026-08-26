const SENSITIVE_KEY_RE =
  /pass(word)?|secret|token|api[_-]?key|service[_-]?role|authorization|bearer|signature|webhook|card|momo|account[_-]?number|cvv|pan|unsubscribe/i;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_HEX_RE = /\b[a-z0-9]{32,}\b/gi;
const BEARER_RE = /bearer\s+[a-z0-9._\-]+/gi;

const MAX_DEPTH = 4;
const MAX_KEYS = 24;
const MAX_STRING = 240;
const MAX_ARRAY = 12;

function redactString(value: string): string {
  return value
    .replace(BEARER_RE, "[redacted]")
    .replace(EMAIL_RE, "[email]")
    .replace(UUID_RE, "[id]")
    .replace(LONG_HEX_RE, "[redacted]")
    .slice(0, MAX_STRING);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (count >= MAX_KEYS) {
        out._truncated = true;
        break;
      }
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = "[redacted]";
        count += 1;
        continue;
      }
      out[key] = sanitizeValue(child, depth + 1);
      count += 1;
    }
    return out;
  }

  return String(value).slice(0, MAX_STRING);
}

/** Strip secrets, tokens, emails, and oversized blobs from operational metadata. */
export function sanitizeOperationalMetadata(
  meta: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!meta) return {};
  const cleaned = sanitizeValue(meta, 0);
  if (!cleaned || typeof cleaned !== "object" || Array.isArray(cleaned)) return {};
  return cleaned as Record<string, unknown>;
}

/** Ops-safe message: no emails, UUIDs, or long secrets. */
export function sanitizeOperationalMessage(message: string, maxLen = 280): string {
  return redactString(message.trim()).slice(0, maxLen) || "Operational failure";
}

/** Collapse volatile tokens so fingerprints stay stable across occurrences. */
export function stabilizeFingerprintToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(EMAIL_RE, "")
    .replace(UUID_RE, "")
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 96);
}
