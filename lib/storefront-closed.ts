/** @deprecated Use `@/lib/store-control` — kept for superadmin site-settings compatibility. */
import {
  defaultMessageForStatus,
  recommendedFlagsForStatus,
} from "@/lib/store-control/constants";
import type { StoreStatus } from "@/lib/store-control/types";

export type StorefrontClosedPreset = Exclude<
  StoreStatus,
  "live" | "presale" | "private_access"
>;

export type StorefrontClosedCopy = {
  headline?: string;
  body?: string;
  reopening_label?: string;
};

export type StorefrontClosedSettings = {
  maintenance_mode: boolean;
  storefront_closed_preset: StorefrontClosedPreset;
  storefront_closed_copy: StorefrontClosedCopy;
};

const PRESETS: StorefrontClosedPreset[] = [
  "maintenance",
  "pre_launch",
  "holiday_break",
  "inventory_update",
];

export function isStorefrontClosedPreset(value: unknown): value is StorefrontClosedPreset {
  return typeof value === "string" && (PRESETS as string[]).includes(value);
}

export function parseStorefrontClosedCopy(value: unknown): StorefrontClosedCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const o = value as Record<string, unknown>;
  return {
    headline: typeof o.headline === "string" ? o.headline : undefined,
    body: typeof o.body === "string" ? o.body : undefined,
    reopening_label: typeof o.reopening_label === "string" ? o.reopening_label : undefined,
  };
}

export function mapStatusToPreset(status: StoreStatus): StorefrontClosedPreset {
  if (status === "pre_launch") return "pre_launch";
  if (status === "holiday_break") return "holiday_break";
  if (status === "inventory_update") return "inventory_update";
  return "maintenance";
}

export function presetDefaultCopy(preset: StorefrontClosedPreset): StorefrontClosedCopy {
  return {
    headline: defaultMessageForStatus(preset === "pre_launch" ? "pre_launch" : preset),
    body: defaultMessageForStatus(preset === "pre_launch" ? "pre_launch" : preset),
  };
}

export { recommendedFlagsForStatus };
