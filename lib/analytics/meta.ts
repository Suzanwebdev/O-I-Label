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

function trackMeta(eventName: string, params?: Record<string, unknown>, eventId?: string): void {
  if (!isMetaEnabled()) return;
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;

  if (eventId) {
    window.fbq("track", eventName, params, { eventID: eventId });
    return;
  }

  window.fbq("track", eventName, params);
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

export function trackMetaPurchase(params: MetaPurchaseParams, orderId: string): void {
  trackMeta("Purchase", params, orderId);
}
