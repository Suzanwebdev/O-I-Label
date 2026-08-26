import { NextResponse } from "next/server";

export type CustomerOperation =
  | "checkout"
  | "checkout_payment"
  | "newsletter"
  | "auth_sign_in"
  | "auth_sign_up"
  | "auth_reset_request"
  | "auth_reset_update"
  | "generic";

const INTERNAL_ERROR_PATTERNS: RegExp[] = [
  /postgres/i,
  /supabase/i,
  /pgrst/i,
  /relation\s+"[^"]+"/i,
  /column\s+"[^"]+"/i,
  /violates\s+(unique|foreign key|check)/i,
  /duplicate key/i,
  /unique constraint/i,
  /stack\s*trace/i,
  /\bat\s+[\w./\\]+\(\d+:\d+\)/,
  /MOOLRE_/i,
  /SUPABASE_/i,
  /APP_BASE_URL/i,
  /NEXT_PUBLIC_/i,
  /process\.env/i,
  /is not configured/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /fetch failed/i,
  /service role/i,
  /permission denied for/i,
  /syntax error at/i,
  /invalid input syntax/i,
  /connection refused/i,
  /database error/i,
  /JWT secret/i,
  /row-level security/i,
  /\bsql\b/i,
  /moolre/i,
];

const AUTH_SAFE_EXACT = new Set([
  "Invalid login credentials",
  "Email not confirmed",
  "User already registered",
  "Signup requires a valid password",
  "Password should be at least 6 characters",
  "Unable to validate email address: invalid format",
  "New password should be different from the old password.",
  "Auth session missing!",
  "Token has expired or is invalid",
]);

const AUTH_SAFE_PATTERNS: RegExp[] = [
  /rate limit/i,
  /too many requests/i,
  /once every \d+ seconds/i,
  /email.*already.*registered/i,
  /invalid login credentials/i,
  /password should be at least/i,
  /email not confirmed/i,
];

const GENERIC_MESSAGES: Record<CustomerOperation, string> = {
  checkout: "We couldn't complete checkout right now. Please try again.",
  checkout_payment:
    "We couldn't process your payment right now. Please try again or use another payment method.",
  newsletter: "We couldn't complete your signup right now. Please try again.",
  auth_sign_in: "Unable to sign in right now. Please try again.",
  auth_sign_up: "Unable to create account right now. Please try again.",
  auth_reset_request: "Unable to send reset email right now. Please try again.",
  auth_reset_update: "Unable to update password right now. Please try again.",
  generic: "Something went wrong. Please try again.",
};

/** Non-sensitive reference for customer support / future health dashboard correlation. */
export function generateIncidentId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `oi_${ts}_${rand}`;
}

export function isIncidentIdSafe(id: string): boolean {
  return /^oi_[a-z0-9]+_[a-z0-9]{6}$/.test(id);
}

export function looksLikeInternalError(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isSafeCustomerMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 280) return false;
  if (looksLikeInternalError(trimmed)) return false;
  return true;
}

function genericMessageFor(operation: CustomerOperation): string {
  return GENERIC_MESSAGES[operation] ?? GENERIC_MESSAGES.generic;
}

export type SanitizedCustomerError = {
  error: string;
  incidentId?: string;
};

export function sanitizeCustomerError(options: {
  operation: CustomerOperation;
  message?: string | null;
  /** App-authored validation copy that must reach the customer unchanged. */
  trusted?: boolean;
}): SanitizedCustomerError {
  const message = options.message?.trim();
  if (options.trusted && message) {
    return { error: message };
  }
  if (message && isSafeCustomerMessage(message)) {
    return { error: message };
  }

  const incidentId = generateIncidentId();
  if (message) {
    logCustomerIncident({
      incidentId,
      operation: options.operation,
      internalMessage: message,
    });
  }

  return {
    error: genericMessageFor(options.operation),
    incidentId,
  };
}

export function sanitizeAuthError(error: {
  message?: string;
  status?: number;
  code?: string;
}): string {
  const message = error.message?.trim();
  if (!message) {
    return genericMessageFor("auth_sign_in");
  }
  if (AUTH_SAFE_EXACT.has(message)) {
    return message;
  }
  if (AUTH_SAFE_PATTERNS.some((pattern) => pattern.test(message))) {
    return message;
  }
  if (looksLikeInternalError(message)) {
    return genericMessageFor("auth_sign_in");
  }
  if (message.length <= 120 && !/error:/i.test(message)) {
    return message;
  }
  return genericMessageFor("auth_sign_in");
}

export function sanitizeAuthErrorForOperation(
  operation: Exclude<
    CustomerOperation,
    "checkout" | "checkout_payment" | "newsletter" | "generic"
  >,
  error: { message?: string; status?: number; code?: string }
): string {
  const message = error.message?.trim();
  if (!message) {
    return genericMessageFor(operation);
  }
  if (AUTH_SAFE_EXACT.has(message)) {
    return message;
  }
  if (AUTH_SAFE_PATTERNS.some((pattern) => pattern.test(message))) {
    return message;
  }
  if (looksLikeInternalError(message)) {
    return genericMessageFor(operation);
  }
  if (message.length <= 120 && !/error:/i.test(message)) {
    return message;
  }
  return genericMessageFor(operation);
}

export function logCustomerIncident(opts: {
  incidentId: string;
  operation: CustomerOperation;
  status?: number;
  internalMessage?: string;
  internalCode?: string;
}): void {
  const payload: Record<string, string | number> = {
    incidentId: opts.incidentId,
    operation: opts.operation,
  };
  if (opts.status != null) payload.status = opts.status;
  if (opts.internalCode) payload.internalCode = opts.internalCode.slice(0, 64);
  if (opts.internalMessage) {
    payload.internalMessage = opts.internalMessage.slice(0, 240);
  }
  console.error("[customer-incident]", JSON.stringify(payload));
}

export function customerErrorResponse(
  status: number,
  options: {
    operation: CustomerOperation;
    message?: string | null;
    trusted?: boolean;
    extra?: Record<string, unknown>;
  }
): NextResponse {
  const sanitized = sanitizeCustomerError(options);
  return NextResponse.json(
    {
      ...(options.extra ?? {}),
      error: sanitized.error,
      ...(sanitized.incidentId ? { incidentId: sanitized.incidentId } : {}),
    },
    { status }
  );
}
