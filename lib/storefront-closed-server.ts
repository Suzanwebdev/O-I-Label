/** @deprecated Use `@/lib/store-control/server` — compatibility shim for legacy imports. */
export {
  assertCheckoutAllowed as assertStorefrontOpen,
  getEffectiveStoreControl,
  getStoreSettingsRow as getStorefrontClosedSettings,
  patchStoreSettings as patchStorefrontClosedSettings,
  parseStoreControlPatch as parseStorefrontClosedPatch,
} from "@/lib/store-control/server";

export type { StoreControlPatch as StorefrontClosedPatch } from "@/lib/store-control/server";
