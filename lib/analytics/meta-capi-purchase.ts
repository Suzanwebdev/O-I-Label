import type { SupabaseClient } from "@supabase/supabase-js";
import { pickOrderItemVariantAttrs } from "@/lib/admin/order-item-variant";
import { buildPurchaseEvent } from "@/lib/analytics/ga4-events";
import { buildMetaPurchaseEvent, type MetaPurchaseParams } from "@/lib/analytics/meta-events";
import {
  buildMetaCapiEventsUrl,
  getMetaCapiConfig,
  isMetaCapiEnabled,
  type MetaCapiConfig,
} from "@/lib/analytics/meta-capi-config";
import { observeOperationalEvent } from "@/lib/errors/capture-event";

export const META_CAPI_PURCHASE_ORDER_EVENT_TYPE = "meta_capi_purchase";

export const META_CAPI_PURCHASE_MAX_ATTEMPTS = 3;
export const META_CAPI_PURCHASE_RETRY_BASE_MS = 750;

export type MetaCapiPurchaseEvent = {
  event_name: "Purchase";
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url: string;
  custom_data: {
    currency: MetaPurchaseParams["currency"];
    value: number;
    content_ids: string[];
    content_type: "product";
    contents: MetaPurchaseParams["contents"];
    num_items: number;
  };
};

export type MetaCapiPurchaseDispatchResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; dispatched: true }
  | { ok: false; reason: string };

type FetchLike = typeof fetch;

export function buildMetaCapiPurchaseEvent(input: {
  orderId: string;
  purchase: MetaPurchaseParams;
  eventSourceUrl: string;
  eventTimeSec?: number;
}): MetaCapiPurchaseEvent {
  return {
    event_name: "Purchase",
    event_time: input.eventTimeSec ?? Math.floor(Date.now() / 1000),
    event_id: input.orderId,
    action_source: "website",
    event_source_url: input.eventSourceUrl,
    custom_data: {
      currency: input.purchase.currency,
      value: input.purchase.value,
      content_ids: input.purchase.content_ids,
      content_type: input.purchase.content_type,
      contents: input.purchase.contents,
      num_items: input.purchase.num_items,
    },
  };
}

export function buildMetaCapiPurchaseRequestBody(
  event: MetaCapiPurchaseEvent,
  config: MetaCapiConfig
): { data: MetaCapiPurchaseEvent[]; test_event_code?: string } {
  const body: { data: MetaCapiPurchaseEvent[]; test_event_code?: string } = {
    data: [event],
  };
  if (config.testEventCode) body.test_event_code = config.testEventCode;
  return body;
}

export async function postMetaCapiPurchaseEvent(
  event: MetaCapiPurchaseEvent,
  config: MetaCapiConfig,
  fetchImpl: FetchLike = fetch
): Promise<{ ok: true } | { ok: false; status?: number; message: string }> {
  const url = new URL(buildMetaCapiEventsUrl(config));
  url.searchParams.set("access_token", config.accessToken);

  let lastMessage = "Meta CAPI request failed";

  for (let attempt = 1; attempt <= META_CAPI_PURCHASE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetchImpl(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMetaCapiPurchaseRequestBody(event, config)),
      });

      if (res.ok) {
        return { ok: true };
      }

      const text = await res.text().catch(() => "");
      lastMessage = `Meta CAPI HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;

      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, status: res.status, message: lastMessage };
      }
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "Meta CAPI network error";
    }

    if (attempt < META_CAPI_PURCHASE_MAX_ATTEMPTS) {
      await sleep(META_CAPI_PURCHASE_RETRY_BASE_MS * attempt);
    }
  }

  return { ok: false, message: lastMessage };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hasMetaCapiPurchaseBeenDispatched(
  supabase: SupabaseClient,
  orderId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("order_events")
    .select("id")
    .eq("order_id", orderId)
    .eq("event_type", META_CAPI_PURCHASE_ORDER_EVENT_TYPE)
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

async function loadPaidOrderPurchasePayload(
  supabase: SupabaseClient,
  orderId: string
): Promise<MetaPurchaseParams | null> {
  const { data: order } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      total_ghs,
      tax_ghs,
      discount_code,
      status,
      paid_at,
      order_items (
        name,
        quantity,
        unit_price_ghs,
        product_id,
        variant_id,
        variants ( color, size )
      )
    `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const isPaid = order.status === "paid" || Boolean(order.paid_at);
  if (!isPaid) return null;

  const gaPurchase = buildPurchaseEvent({
    orderNumber: String(order.order_number),
    totalGhs: Number(order.total_ghs),
    taxGhs: order.tax_ghs != null ? Number(order.tax_ghs) : 0,
    discountCode: order.discount_code ?? null,
    items: (Array.isArray(order.order_items) ? order.order_items : []).map((row) => {
      const { color, size } = pickOrderItemVariantAttrs(row.variants);
      return {
        product_id: row.product_id ? String(row.product_id) : null,
        variant_id: row.variant_id ? String(row.variant_id) : null,
        name: String(row.name ?? "Item"),
        quantity: Number(row.quantity ?? 1),
        unit_price_ghs: Number(row.unit_price_ghs ?? 0),
        color,
        size,
      };
    }),
  });

  return buildMetaPurchaseEvent(gaPurchase);
}

/**
 * Idempotently send a Meta CAPI Purchase for a paid order.
 * Fire-and-forget safe: failures never throw to callers.
 */
export async function dispatchMetaCapiPurchaseIfNeeded(
  supabase: SupabaseClient,
  orderId: string,
  opts?: { source?: string; fetchImpl?: FetchLike }
): Promise<MetaCapiPurchaseDispatchResult> {
  if (!isMetaCapiEnabled()) {
    return { ok: true, skipped: true, reason: "capi_disabled" };
  }

  const config = getMetaCapiConfig();
  if (!config) {
    return { ok: true, skipped: true, reason: "capi_disabled" };
  }

  if (await hasMetaCapiPurchaseBeenDispatched(supabase, orderId)) {
    return { ok: true, skipped: true, reason: "already_dispatched" };
  }

  const purchase = await loadPaidOrderPurchasePayload(supabase, orderId);
  if (!purchase) {
    return { ok: true, skipped: true, reason: "order_not_paid_or_missing" };
  }

  const event = buildMetaCapiPurchaseEvent({
    orderId,
    purchase,
    eventSourceUrl: `${config.siteUrl}/checkout/success?order=${encodeURIComponent(orderId)}`,
  });

  const result = await postMetaCapiPurchaseEvent(event, config, opts?.fetchImpl ?? fetch);
  if (!result.ok) {
    observeOperationalEvent({
      severity: "warning",
      category: "api",
      surface: opts?.source === "webhook" ? "webhook" : opts?.source === "reconcile" ? "cron" : "storefront",
      code: "meta_capi_purchase_failed",
      message: "Meta CAPI Purchase dispatch failed",
      metadata: {
        reason: result.message,
        status: result.status ?? null,
        source: opts?.source ?? null,
      },
    });
    return { ok: false, reason: result.message };
  }

  await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: META_CAPI_PURCHASE_ORDER_EVENT_TYPE,
    actor_id: null,
    message: "Meta CAPI Purchase event dispatched",
    meta: {
      event_id: orderId,
      source: opts?.source ?? null,
      currency: purchase.currency,
      value: purchase.value,
      num_items: purchase.num_items,
    },
  });

  return { ok: true, dispatched: true };
}
