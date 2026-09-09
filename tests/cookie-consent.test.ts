import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildConsentDecision,
  canUseAnalytics,
  canUseMarketing,
  readConsentState,
  writeConsentState,
} from "../lib/consent/storage.ts";
import {
  CONSENT_STORAGE_KEY,
  defaultConsentState,
  hasExplicitConsentDecision,
} from "../lib/consent/types.ts";

function memoryLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    raw: map,
  };
}

const previousWindow = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  const storage = memoryLocalStorage();
  (globalThis as { window: { localStorage: ReturnType<typeof memoryLocalStorage> } }).window = {
    localStorage: storage,
  };
});

afterEach(() => {
  if (previousWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window: unknown }).window = previousWindow;
  }
});

describe("cookie consent storage", () => {
  it("defaults optional categories to false with no decision", () => {
    const state = readConsentState();
    assert.deepEqual(state, defaultConsentState());
    assert.equal(hasExplicitConsentDecision(state), false);
    assert.equal(canUseAnalytics(state), false);
    assert.equal(canUseMarketing(state), false);
  });

  it("does not treat missing storage as acceptance", () => {
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), false);
  });

  it("Accept All enables analytics and marketing", () => {
    const next = buildConsentDecision({ analytics: true, marketing: true });
    writeConsentState(next);
    const state = readConsentState();
    assert.equal(state.analytics, true);
    assert.equal(state.marketing, true);
    assert.equal(canUseAnalytics(state), true);
    assert.equal(canUseMarketing(state), true);
  });

  it("Reject All disables analytics and marketing", () => {
    const next = buildConsentDecision({ analytics: false, marketing: false });
    writeConsentState(next);
    const state = readConsentState();
    assert.equal(state.analytics, false);
    assert.equal(state.marketing, false);
    assert.equal(canUseAnalytics(state), false);
    assert.equal(canUseMarketing(state), false);
  });

  it("supports analytics-only preferences", () => {
    const next = buildConsentDecision({ analytics: true, marketing: false });
    writeConsentState(next);
    const state = readConsentState();
    assert.equal(canUseAnalytics(state), true);
    assert.equal(canUseMarketing(state), false);
  });

  it("supports marketing-only preferences", () => {
    const next = buildConsentDecision({ analytics: false, marketing: true });
    writeConsentState(next);
    const state = readConsentState();
    assert.equal(canUseAnalytics(state), false);
    assert.equal(canUseMarketing(state), true);
  });

  it("persists choices across reload (re-read)", () => {
    writeConsentState(buildConsentDecision({ analytics: true, marketing: false }));
    const first = readConsentState();
    assert.equal(first.analytics, true);
    assert.equal(first.marketing, false);
    assert.ok(first.decidedAt);

    const again = readConsentState();
    assert.deepEqual(again, first);
    assert.ok(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  });

  it("updates preferences when choices change", () => {
    writeConsentState(buildConsentDecision({ analytics: false, marketing: false }));
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), false);

    writeConsentState(buildConsentDecision({ analytics: true, marketing: false }));
    assert.equal(canUseAnalytics(), true);
    assert.equal(canUseMarketing(), false);

    writeConsentState(buildConsentDecision({ analytics: true, marketing: true }));
    assert.equal(canUseAnalytics(), true);
    assert.equal(canUseMarketing(), true);

    writeConsentState(buildConsentDecision({ analytics: false, marketing: true }));
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), true);
  });

  it("ignores invalid stored payloads", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ analytics: true }));
    const state = readConsentState();
    assert.deepEqual(state, defaultConsentState());
    assert.equal(canUseAnalytics(state), false);
  });
});

describe("consent gating helpers for trackers", () => {
  it("late consent: granting analytics after reject enables GA gate only", () => {
    writeConsentState(buildConsentDecision({ analytics: false, marketing: false }));
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), false);

    writeConsentState(buildConsentDecision({ analytics: true, marketing: false }));
    assert.equal(canUseAnalytics(), true);
    assert.equal(canUseMarketing(), false);
  });

  it("late consent: granting marketing after reject enables Meta gate only", () => {
    writeConsentState(buildConsentDecision({ analytics: false, marketing: false }));
    writeConsentState(buildConsentDecision({ analytics: false, marketing: true }));
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), true);
  });

  it("revocation clears optional gates without requiring cookie scrubbing", () => {
    writeConsentState(buildConsentDecision({ analytics: true, marketing: true }));
    assert.equal(canUseAnalytics(), true);
    assert.equal(canUseMarketing(), true);

    writeConsentState(buildConsentDecision({ analytics: false, marketing: true }));
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), true);

    writeConsentState(buildConsentDecision({ analytics: false, marketing: false }));
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), false);
  });
});
