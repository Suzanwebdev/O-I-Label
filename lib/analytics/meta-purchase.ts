import type { MetaPurchaseParams } from "@/lib/analytics/meta-events";
import { metaPurchaseStorageKey } from "@/lib/analytics/meta-events";
import { isMetaEnabled, trackMetaPurchase } from "@/lib/analytics/meta";

export type MetaPurchaseDispatchResult = "sent" | "already" | "not_ready" | "disabled";

export const META_PURCHASE_FBQ_RETRY_ATTEMPTS = 20;
export const META_PURCHASE_FBQ_RETRY_INTERVAL_MS = 500;

/**
 * Attempt a single Meta Purchase dispatch.
 * Writes the sessionStorage dedupe key only after fbq accepts the call.
 * Never weakens one-Purchase-per-order semantics.
 */
export function tryDispatchMetaPurchaseWithDedupe(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  orderId: string,
  params: MetaPurchaseParams,
  dispatch: (params: MetaPurchaseParams, orderId: string) => boolean = trackMetaPurchase
): MetaPurchaseDispatchResult {
  if (!storage) return "disabled";
  if (!orderId) return "disabled";
  if (!isMetaEnabled()) return "disabled";

  const key = metaPurchaseStorageKey(orderId);
  if (storage.getItem(key)) return "already";

  const sent = dispatch(params, orderId);
  if (!sent) return "not_ready";

  storage.setItem(key, "1");
  return "sent";
}
