import {
  CONSENT_STORAGE_KEY,
  CONSENT_STORAGE_VERSION,
  defaultConsentState,
  type ConsentState,
  type StoredConsentV1,
} from "@/lib/consent/types";

function isStoredConsentV1(value: unknown): value is StoredConsentV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    row.version === CONSENT_STORAGE_VERSION &&
    typeof row.decidedAt === "string" &&
    row.decidedAt.length > 0 &&
    typeof row.analytics === "boolean" &&
    typeof row.marketing === "boolean"
  );
}

export function readConsentState(): ConsentState {
  if (typeof window === "undefined") return defaultConsentState();
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return defaultConsentState();
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredConsentV1(parsed)) return defaultConsentState();
    return {
      essential: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      decidedAt: parsed.decidedAt,
    };
  } catch {
    return defaultConsentState();
  }
}

export function writeConsentState(state: ConsentState): void {
  if (typeof window === "undefined") return;
  if (!state.decidedAt) {
    try {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }

  const payload: StoredConsentV1 = {
    version: CONSENT_STORAGE_VERSION,
    decidedAt: state.decidedAt,
    analytics: Boolean(state.analytics),
    marketing: Boolean(state.marketing),
  };

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode failures
  }
}

export function buildConsentDecision(input: {
  analytics: boolean;
  marketing: boolean;
  decidedAt?: string;
}): ConsentState {
  return {
    essential: true,
    analytics: Boolean(input.analytics),
    marketing: Boolean(input.marketing),
    decidedAt: input.decidedAt ?? new Date().toISOString(),
  };
}

/** Safe for analytics helpers: false until an explicit decision enables analytics. */
export function canUseAnalytics(state: ConsentState = readConsentState()): boolean {
  return Boolean(state.decidedAt && state.analytics);
}

/** Safe for Meta Pixel helpers: false until an explicit decision enables marketing. */
export function canUseMarketing(state: ConsentState = readConsentState()): boolean {
  return Boolean(state.decidedAt && state.marketing);
}
