import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  isStorefrontClosedPreset,
  parseStorefrontClosedCopy,
  type StorefrontClosedCopy,
  type StorefrontClosedPreset,
  type StorefrontClosedSettings,
} from "@/lib/storefront-closed";

const STOREFRONT_SELECT =
  "maintenance_mode, storefront_closed_preset, storefront_closed_copy";

function mapStorefrontRow(row: {
  maintenance_mode: boolean | null;
  storefront_closed_preset: string | null;
  storefront_closed_copy: unknown;
}): StorefrontClosedSettings {
  return {
    maintenance_mode: Boolean(row.maintenance_mode),
    storefront_closed_preset: isStorefrontClosedPreset(row.storefront_closed_preset)
      ? row.storefront_closed_preset
      : "maintenance",
    storefront_closed_copy: parseStorefrontClosedCopy(row.storefront_closed_copy),
  };
}

export async function getStorefrontClosedSettings(): Promise<StorefrontClosedSettings | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("site_settings")
    .select(STOREFRONT_SELECT)
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return null;
  return mapStorefrontRow(data);
}

export async function assertStorefrontOpen(): Promise<
  | { ok: true; settings: StorefrontClosedSettings }
  | { ok: false; status: number; error: string; code: string; preset: StorefrontClosedPreset }
> {
  const settings = await getStorefrontClosedSettings();
  if (!settings) {
    return { ok: true, settings: { maintenance_mode: false, storefront_closed_preset: "maintenance", storefront_closed_copy: {} } };
  }
  if (!settings.maintenance_mode) {
    return { ok: true, settings };
  }
  return {
    ok: false,
    status: 503,
    error: "The storefront is temporarily closed. Please try again later.",
    code: "storefront_closed",
    preset: settings.storefront_closed_preset,
  };
}

export type StorefrontClosedPatch = {
  maintenance_mode?: boolean;
  storefront_closed_preset?: StorefrontClosedPreset;
  storefront_closed_copy?: StorefrontClosedCopy;
};

export function parseStorefrontClosedPatch(body: unknown): {
  ok: true;
  patch: StorefrontClosedPatch;
} | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const patch: StorefrontClosedPatch = {};

  if ("maintenance_mode" in b) {
    if (typeof b.maintenance_mode !== "boolean") {
      return { ok: false, error: "maintenance_mode must be a boolean" };
    }
    patch.maintenance_mode = b.maintenance_mode;
  }

  if ("storefront_closed_preset" in b) {
    if (!isStorefrontClosedPreset(b.storefront_closed_preset)) {
      return { ok: false, error: "Invalid storefront_closed_preset" };
    }
    patch.storefront_closed_preset = b.storefront_closed_preset;
  }

  if ("storefront_closed_copy" in b) {
    patch.storefront_closed_copy = parseStorefrontClosedCopy(b.storefront_closed_copy);
  }

  if (!Object.keys(patch).length) {
    return { ok: false, error: "No valid fields to update" };
  }

  return { ok: true, patch };
}

export async function patchStorefrontClosedSettings(
  patch: StorefrontClosedPatch
): Promise<StorefrontClosedSettings | null> {
  const service = createServiceRoleClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.maintenance_mode !== undefined) update.maintenance_mode = patch.maintenance_mode;
  if (patch.storefront_closed_preset !== undefined) {
    update.storefront_closed_preset = patch.storefront_closed_preset;
  }
  if (patch.storefront_closed_copy !== undefined) {
    update.storefront_closed_copy = patch.storefront_closed_copy;
  }

  const { data, error } = await service
    .from("site_settings")
    .update(update)
    .eq("id", 1)
    .select(STOREFRONT_SELECT)
    .single();

  if (error || !data) return null;
  return mapStorefrontRow(data);
}
