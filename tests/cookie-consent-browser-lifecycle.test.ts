import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import {
  META_BOOTSTRAP_PAGE_VIEW_FLAG,
  resolveMetaActivationPageView,
} from "../lib/analytics/meta-pixel-activation.ts";
import {
  buildConsentDecision,
  canUseAnalytics,
  canUseMarketing,
  readConsentState,
  writeConsentState,
} from "../lib/consent/storage.ts";
import { CONSENT_STORAGE_KEY, hasExplicitConsentDecision } from "../lib/consent/types.ts";
import { buildPurchaseEvent } from "../lib/analytics/ga4-events.ts";
import { buildMetaPurchaseEvent, metaPurchaseStorageKey } from "../lib/analytics/meta-events.ts";
import { tryDispatchMetaPurchaseWithDedupe } from "../lib/analytics/meta-purchase.ts";

/**
 * Browser-level lifecycle coverage without installing a new E2E framework.
 * The repo has no first-party Playwright/Cypress setup; these tests exercise
 * consent persistence, tracker gating, Meta activation PageView rules, and
 * storefront source contracts that the UI and essential routes rely on.
 */

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
const previousPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const previousGaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

beforeEach(() => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "2051174339097074";
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";
  (globalThis as { window: Record<string, unknown> }).window = {
    localStorage: memoryLocalStorage(),
  };
});

afterEach(() => {
  mock.restoreAll();
  if (previousPixelId === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  else process.env.NEXT_PUBLIC_META_PIXEL_ID = previousPixelId;
  if (previousGaId === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = previousGaId;
  if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window: unknown }).window = previousWindow;
});

function trackerMountPlan(state = readConsentState()) {
  return {
    showBanner: !hasExplicitConsentDecision(state),
    mountGa4: canUseAnalytics(state),
    mountMeta: canUseMarketing(state),
  };
}

describe("Meta activation PageView resolution", () => {
  it("consumes bootstrap flag on first grant so React does not double-fire", () => {
    assert.equal(
      resolveMetaActivationPageView({
        bootstrapFlag: true,
        fbqAvailable: true,
        marketingAllowed: true,
      }),
      "consume-bootstrap"
    );
  });

  it("fires exactly one activation PageView on re-enable when fbq already exists", () => {
    assert.equal(
      resolveMetaActivationPageView({
        bootstrapFlag: false,
        fbqAvailable: true,
        marketingAllowed: true,
      }),
      "fire"
    );
  });

  it("skips when marketing is denied or fbq is unavailable without bootstrap", () => {
    assert.equal(
      resolveMetaActivationPageView({
        bootstrapFlag: false,
        fbqAvailable: true,
        marketingAllowed: false,
      }),
      "skip"
    );
    assert.equal(
      resolveMetaActivationPageView({
        bootstrapFlag: false,
        fbqAvailable: false,
        marketingAllowed: true,
      }),
      "skip"
    );
  });
});

describe("cookie consent browser lifecycle (simulated)", () => {
  it("TEST A — first visit: no decision, banner should show, trackers off", () => {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    const plan = trackerMountPlan();
    assert.equal(plan.showBanner, true);
    assert.equal(plan.mountGa4, false);
    assert.equal(plan.mountMeta, false);
  });

  it("TEST B — Reject All: banner closes, GA4 and Meta stay off", () => {
    writeConsentState(buildConsentDecision({ analytics: false, marketing: false }));
    const plan = trackerMountPlan();
    assert.equal(plan.showBanner, false);
    assert.equal(plan.mountGa4, false);
    assert.equal(plan.mountMeta, false);
  });

  it("TEST C — Accept All: both trackers allowed once", () => {
    writeConsentState(buildConsentDecision({ analytics: true, marketing: true }));
    const plan = trackerMountPlan();
    assert.equal(plan.showBanner, false);
    assert.equal(plan.mountGa4, true);
    assert.equal(plan.mountMeta, true);
  });

  it("TEST D — Analytics only", () => {
    writeConsentState(buildConsentDecision({ analytics: true, marketing: false }));
    const plan = trackerMountPlan();
    assert.equal(plan.mountGa4, true);
    assert.equal(plan.mountMeta, false);
  });

  it("TEST E — Marketing only", () => {
    writeConsentState(buildConsentDecision({ analytics: false, marketing: true }));
    const plan = trackerMountPlan();
    assert.equal(plan.mountGa4, false);
    assert.equal(plan.mountMeta, true);
  });

  it("TEST F — persistence across reload", () => {
    writeConsentState(buildConsentDecision({ analytics: true, marketing: false }));
    const afterReload = trackerMountPlan(readConsentState());
    assert.equal(afterReload.showBanner, false);
    assert.equal(afterReload.mountGa4, true);
    assert.equal(afterReload.mountMeta, false);
    assert.ok(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  });

  it("TEST G — change preferences: revoke Analytics after Accept All", () => {
    writeConsentState(buildConsentDecision({ analytics: true, marketing: true }));
    assert.equal(canUseAnalytics(), true);
    writeConsentState(buildConsentDecision({ analytics: false, marketing: true }));
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), true);
  });

  it("TEST H — essential surfaces stay independent of optional consent", () => {
    writeConsentState(buildConsentDecision({ analytics: false, marketing: false }));
    assert.equal(canUseAnalytics(), false);
    assert.equal(canUseMarketing(), false);

    const cartProvider = readFileSync("components/providers/cart-provider.tsx", "utf8");
    const checkoutPage = readFileSync("app/(store)/checkout/page.tsx", "utf8");
    const productPage = readFileSync("app/(store)/product/[slug]/page.tsx", "utf8");

    for (const source of [cartProvider, checkoutPage, productPage]) {
      assert.doesNotMatch(source, /canUseAnalytics|canUseMarketing|ConsentProvider/);
    }
  });
});

describe("Meta grant → revoke → re-grant PageView and Purchase safety", () => {
  it("fires one bootstrap PageView, then one re-enable PageView, without deleting fbq", async () => {
    const calls: Array<{ args: unknown[] }> = [];
    const fbq = mock.fn((...args: unknown[]) => {
      calls.push({ args });
    });

    // First grant: simulate bootstrap script (fbq created, PageView + flag).
    (window as { fbq?: typeof fbq }).fbq = fbq;
    writeConsentState(buildConsentDecision({ analytics: false, marketing: true }));
    fbq("track", "PageView");
    (window as Record<string, unknown>)[META_BOOTSTRAP_PAGE_VIEW_FLAG] = true;

    let action = resolveMetaActivationPageView({
      bootstrapFlag: Boolean((window as Record<string, unknown>)[META_BOOTSTRAP_PAGE_VIEW_FLAG]),
      fbqAvailable: typeof window.fbq === "function",
      marketingAllowed: canUseMarketing(),
    });
    assert.equal(action, "consume-bootstrap");
    (window as Record<string, unknown>)[META_BOOTSTRAP_PAGE_VIEW_FLAG] = false;

    const { trackMetaPageView, trackMetaPurchase } = await import("../lib/analytics/meta.ts");
    // React effect consumed bootstrap — no second fire.
    assert.equal(fbq.mock.callCount(), 1);

    // Revoke marketing: events must stop even though fbq remains.
    writeConsentState(buildConsentDecision({ analytics: false, marketing: false }));
    trackMetaPageView();
    assert.equal(fbq.mock.callCount(), 1);

    // Re-grant: fbq still present, no bootstrap flag → fire exactly once.
    writeConsentState(buildConsentDecision({ analytics: false, marketing: true }));
    action = resolveMetaActivationPageView({
      bootstrapFlag: Boolean((window as Record<string, unknown>)[META_BOOTSTRAP_PAGE_VIEW_FLAG]),
      fbqAvailable: typeof window.fbq === "function",
      marketingAllowed: canUseMarketing(),
    });
    assert.equal(action, "fire");
    trackMetaPageView();
    assert.equal(fbq.mock.callCount(), 2);
    assert.equal(calls[1]?.args[1], "PageView");

    // Purchase eventID remains order UUID; dedupe still once.
    const orderId = "c0n5ent-meta-reenable-0001-000000000001";
    const purchasePayload = buildMetaPurchaseEvent(
      buildPurchaseEvent({
        orderNumber: "OI-TEST-CONSENT",
        totalGhs: 100,
        items: [
          {
            product_id: "product-1",
            variant_id: "variant-1",
            name: "Dress",
            quantity: 1,
            unit_price_ghs: 100,
          },
        ],
      })
    );

    const storage = {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
    };

    const send = () =>
      trackMetaPurchase(purchasePayload, orderId);

    assert.equal(tryDispatchMetaPurchaseWithDedupe(storage, orderId, purchasePayload, send), "sent");
    assert.equal(
      tryDispatchMetaPurchaseWithDedupe(storage, orderId, purchasePayload, send),
      "already"
    );
    assert.equal(window.localStorage.getItem(metaPurchaseStorageKey(orderId)), "1");

    const purchaseCalls = calls.filter((c) => c.args[1] === "Purchase");
    assert.equal(purchaseCalls.length, 1);
    assert.deepEqual(purchaseCalls[0]?.args[3], { eventID: orderId });

    // fbq object identity preserved (not deleted/recreated).
    assert.equal((window as { fbq?: typeof fbq }).fbq, fbq);
  });
});

describe("consent UI and Meta Pixel source contracts", () => {
  it("banner copy and actions remain wired", () => {
    const ui = readFileSync("components/consent/cookie-consent-ui.tsx", "utf8");
    assert.match(ui, /We use cookies to make your shopping experience smoother/);
    assert.match(ui, /Accept All/);
    assert.match(ui, /Reject All/);
    assert.match(ui, /Preferences/);
    assert.match(ui, /\/policies\/cookies/);
    assert.match(ui, /Save Preferences/);
  });

  it("Meta Pixel script sets bootstrap flag and avoids deleting fbq", () => {
    const pixel = readFileSync("components/analytics/meta-pixel.tsx", "utf8");
    assert.match(pixel, /META_BOOTSTRAP_PAGE_VIEW_FLAG/);
    assert.match(pixel, /hadFbq/);
    assert.match(pixel, /resolveMetaActivationPageView/);
    assert.doesNotMatch(pixel, /delete window\.fbq|window\.fbq\s*=\s*undefined|window\.fbq\s*=\s*null/);
  });

  it("Cookie Policy distinguishes Pixel from CAPI and essential shopping", () => {
    const policy = readFileSync("app/(store)/policies/[slug]/page.tsx", "utf8");
    assert.match(policy, /Google Analytics 4/);
    assert.match(policy, /Meta \(Facebook\) Pixel/);
    assert.match(policy, /Conversions API/);
    assert.match(
      policy,
      /separate from the optional browser tracking controlled by your cookie preferences/
    );
    assert.match(policy, /private-store access cookie/);
    assert.match(policy, /Supabase/);
    assert.match(policy, /CookieSettingsButton/);
    assert.match(policy, /slug === "cookies"/);
    assert.match(policy, /Cookie Settings below/);
  });

  it("footer keeps Cookie Policy under Company and restores the original legal row", () => {
    const footer = readFileSync("components/layout/store-footer.tsx", "utf8");
    const defaults = readFileSync("lib/home/homepage-cms.ts", "utf8");

    assert.match(defaults, /href: "\/policies\/cookies", label: "Cookie Policy"/);
    assert.match(footer, /withCookiePolicyInCompany/);
    assert.match(footer, /© \{year\} \{brand\}/);
    assert.match(footer, /MomoNetworkLogos/);
    assert.doesNotMatch(footer, /CookieSettingsButton/);
    assert.doesNotMatch(
      footer,
      /href="\/policies\/cookies"[\s\S]*Cookie Policy[\s\S]*MomoNetworkLogos/
    );
  });

  it("MetaPageViewTracker still skips first SPA render to avoid duplicate PageView", () => {
    const tracker = readFileSync("components/analytics/meta-page-view.tsx", "utf8");
    assert.match(tracker, /isFirstRender/);
    assert.match(tracker, /isFirstRender\.current = false/);
  });
});
