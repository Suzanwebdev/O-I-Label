"use client";

import { sendGAEvent } from "@next/third-parties/google";
import type {
  Ga4AddToCartParams,
  Ga4BeginCheckoutParams,
  Ga4PurchaseParams,
  Ga4ViewItemParams,
} from "@/lib/analytics/ga4-events";

export function isGa4Enabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim());
}

export function trackGa4Event(eventName: string, params: Record<string, unknown>): void {
  if (!isGa4Enabled()) return;
  if (typeof window === "undefined") return;
  sendGAEvent("event", eventName, params);
}

export function trackViewItem(params: Ga4ViewItemParams): void {
  trackGa4Event("view_item", params);
}

export function trackAddToCart(params: Ga4AddToCartParams): void {
  trackGa4Event("add_to_cart", params);
}

export function trackBeginCheckout(params: Ga4BeginCheckoutParams): void {
  trackGa4Event("begin_checkout", params);
}

export function trackPurchase(params: Ga4PurchaseParams): void {
  trackGa4Event("purchase", params);
}
