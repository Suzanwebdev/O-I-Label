/**
 * Future transactional email: "How did you like your O & I piece?"
 * Isolated so review-request sends can be wired without touching checkout/payment.
 *
 * Do not auto-send until product/ops explicitly enable a post-delivery workflow.
 */
export type ReviewRequestEmailPayload = {
  to: string;
  customerName: string | null;
  orderNumber: string;
  productName: string;
  productSlug: string | null;
  orderItemId: string;
  reviewPath: string;
};

export function buildReviewRequestPath(opts: {
  productSlug: string | null;
  orderItemId: string;
}): string {
  if (opts.productSlug) {
    return `/product/${opts.productSlug}?reviewItem=${encodeURIComponent(opts.orderItemId)}`;
  }
  return `/account/orders`;
}

export async function sendReviewRequestEmail(
  _payload: ReviewRequestEmailPayload
): Promise<{ ok: true; skipped: true } | { ok: false; error: string }> {
  // Intentionally no-op until an automated post-purchase workflow is approved.
  return { ok: true, skipped: true };
}
