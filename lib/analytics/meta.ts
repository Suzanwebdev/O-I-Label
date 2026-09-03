"use client";

import type {
  MetaAddToCartParams,
  MetaInitiateCheckoutParams,
  MetaPurchaseParams,
  MetaViewContentParams,
} from "@/lib/analytics/meta-events";

type FbqFunction = (
  command: "track" | "init",
  eventNameOrPixelId: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
) => void;

declare global {
  interface Window {
    fbq?: FbqFunction;
  }
}

export function isMetaEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim());
}

function trackMeta(eventName: string, params?: Record<string, unknown>, eventId?: string): boolean {
  if (!isMetaEnabled()) return false;
  if (typeof window === "undefined" || typeof window.fbq !== "function") return false;

  if (eventId) {
    window.fbq("track", eventName, params, { eventID: eventId });
    return true;
  }

  window.fbq("track", eventName, params);
  return true;
}

export function trackMetaPageView(): void {
  trackMeta("PageView");
}

export function trackMetaViewContent(params: MetaViewContentParams): void {
  trackMeta("ViewContent", params);
}

export function trackMetaAddToCart(params: MetaAddToCartParams): void {
  trackMeta("AddToCart", params);
}

export function trackMetaInitiateCheckout(params: MetaInitiateCheckoutParams): void {
  trackMeta("InitiateCheckout", params);
}

/** Returns true only when fbq accepted the Purchase call (eventID = order UUID). */
export function trackMetaPurchase(params: MetaPurchaseParams, orderId: string): boolean {
  return trackMeta("Purchase", params, orderId);
}
