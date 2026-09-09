export type ConsentCategories = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentState = ConsentCategories & {
  /** Null means the visitor has not made an explicit choice yet. */
  decidedAt: string | null;
};

export const CONSENT_STORAGE_KEY = "oi-label-cookie-consent";
export const CONSENT_STORAGE_VERSION = 1;

export type StoredConsentV1 = {
  version: typeof CONSENT_STORAGE_VERSION;
  decidedAt: string;
  analytics: boolean;
  marketing: boolean;
};

export function defaultConsentState(): ConsentState {
  return {
    essential: true,
    analytics: false,
    marketing: false,
    decidedAt: null,
  };
}

export function hasExplicitConsentDecision(state: ConsentState): boolean {
  return Boolean(state.decidedAt);
}
