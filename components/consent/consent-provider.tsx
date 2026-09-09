"use client";

import * as React from "react";
import {
  buildConsentDecision,
  canUseAnalytics,
  canUseMarketing,
  readConsentState,
  writeConsentState,
} from "@/lib/consent/storage";
import {
  defaultConsentState,
  hasExplicitConsentDecision,
  type ConsentState,
} from "@/lib/consent/types";
import { CookieConsentUi } from "@/components/consent/cookie-consent-ui";

type ConsentContextValue = {
  ready: boolean;
  state: ConsentState;
  decided: boolean;
  analyticsAllowed: boolean;
  marketingAllowed: boolean;
  preferencesOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: { analytics: boolean; marketing: boolean }) => void;
  openPreferences: () => void;
  closePreferences: () => void;
};

const ConsentContext = React.createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [state, setState] = React.useState<ConsentState>(defaultConsentState);
  const [preferencesOpen, setPreferencesOpen] = React.useState(false);

  React.useEffect(() => {
    setState(readConsentState());
    setReady(true);
  }, []);

  const applyDecision = React.useCallback((next: ConsentState) => {
    writeConsentState(next);
    setState(next);
  }, []);

  const acceptAll = React.useCallback(() => {
    applyDecision(buildConsentDecision({ analytics: true, marketing: true }));
    setPreferencesOpen(false);
  }, [applyDecision]);

  const rejectAll = React.useCallback(() => {
    applyDecision(buildConsentDecision({ analytics: false, marketing: false }));
    setPreferencesOpen(false);
  }, [applyDecision]);

  const savePreferences = React.useCallback(
    (prefs: { analytics: boolean; marketing: boolean }) => {
      applyDecision(
        buildConsentDecision({
          analytics: prefs.analytics,
          marketing: prefs.marketing,
        })
      );
      setPreferencesOpen(false);
    },
    [applyDecision]
  );

  const openPreferences = React.useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = React.useCallback(() => setPreferencesOpen(false), []);

  const value = React.useMemo<ConsentContextValue>(
    () => ({
      ready,
      state,
      decided: hasExplicitConsentDecision(state),
      analyticsAllowed: canUseAnalytics(state),
      marketingAllowed: canUseMarketing(state),
      preferencesOpen,
      acceptAll,
      rejectAll,
      savePreferences,
      openPreferences,
      closePreferences,
    }),
    [
      ready,
      state,
      preferencesOpen,
      acceptAll,
      rejectAll,
      savePreferences,
      openPreferences,
      closePreferences,
    ]
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
      <CookieConsentUi />
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = React.useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within ConsentProvider");
  }
  return ctx;
}

/** Optional hook for components that may render outside the store consent tree. */
export function useConsentOptional(): ConsentContextValue | null {
  return React.useContext(ConsentContext);
}
