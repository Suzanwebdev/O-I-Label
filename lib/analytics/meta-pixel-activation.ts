/**
 * Decides how to handle the marketing-activation PageView without resetting fbq.
 *
 * First bootstrap: the Meta Pixel inline script queues PageView and sets a
 * one-shot bootstrap flag. The React effect consumes that flag so it does not
 * fire a second PageView.
 *
 * Re-enable after revoke: fbq usually still exists, so the script skips the
 * bootstrap PageView. The effect then fires exactly one PageView via trackMeta.
 */
export type MetaActivationPageViewAction = "consume-bootstrap" | "fire" | "skip";

export const META_BOOTSTRAP_PAGE_VIEW_FLAG = "__oiMetaBootstrapPageView";

export function resolveMetaActivationPageView(input: {
  bootstrapFlag: boolean;
  fbqAvailable: boolean;
  marketingAllowed: boolean;
}): MetaActivationPageViewAction {
  if (!input.marketingAllowed) return "skip";
  if (input.bootstrapFlag) return "consume-bootstrap";
  if (input.fbqAvailable) return "fire";
  return "skip";
}
