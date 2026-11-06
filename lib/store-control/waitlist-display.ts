import type { EffectiveStoreControl } from "@/lib/store-control/types";

/**
 * Whether a surface can show the waitlist count, so the count query can be skipped
 * when it cannot. These must stay in sync with the rendering conditions in
 * `PresaleLaunchStrip` and `app/closed/[slug]/page.tsx`; the count itself must
 * also be greater than zero before it is displayed.
 */

/** Storefront layout: only `PresaleLaunchStrip` renders the count. */
export function storefrontShowsWaitlistCount(control: EffectiveStoreControl): boolean {
  return (
    control.storeStatus === "presale" &&
    control.countdownEnabled &&
    Boolean(control.countdownTarget) &&
    control.showWaitlistCount
  );
}

/** Closed pages: only the presale and pre-launch pages render the count. */
export function closedPageShowsWaitlistCount(slug: string, control: EffectiveStoreControl): boolean {
  return (slug === "presale" || slug === "pre-launch") && control.showWaitlistCount;
}
