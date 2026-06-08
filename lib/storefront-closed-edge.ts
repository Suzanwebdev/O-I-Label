import { createClient } from "@supabase/supabase-js";
import {
  isStorefrontClosedPreset,
  parseStorefrontClosedCopy,
  type StorefrontClosedSettings,
} from "@/lib/storefront-closed";

const CACHE_TTL_MS = 15_000;

let cached:
  | { expiresAt: number; settings: StorefrontClosedSettings | null }
  | null = null;

export function invalidateStorefrontClosedEdgeCache(): void {
  cached = null;
}

export async function fetchStorefrontClosedSettingsEdge(): Promise<StorefrontClosedSettings | null> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.settings;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    cached = { expiresAt: now + CACHE_TTL_MS, settings: null };
    return null;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("site_settings")
    .select("maintenance_mode, storefront_closed_preset, storefront_closed_copy")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    cached = { expiresAt: now + CACHE_TTL_MS, settings: null };
    return null;
  }

  const settings: StorefrontClosedSettings = {
    maintenance_mode: Boolean(data.maintenance_mode),
    storefront_closed_preset: isStorefrontClosedPreset(data.storefront_closed_preset)
      ? data.storefront_closed_preset
      : "maintenance",
    storefront_closed_copy: parseStorefrontClosedCopy(data.storefront_closed_copy),
  };

  cached = { expiresAt: now + CACHE_TTL_MS, settings };
  return settings;
}
