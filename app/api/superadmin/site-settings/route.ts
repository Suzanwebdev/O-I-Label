import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  isStorefrontClosedPreset,
  parseStorefrontClosedCopy,
} from "@/lib/storefront-closed";
import {
  parseStorefrontClosedPatch,
} from "@/lib/storefront-closed-server";

const SELECT =
  "store_name, maintenance_mode, storefront_closed_preset, storefront_closed_copy, feature_flags, payment_moolre_enabled, payment_paystack_enabled, payment_flutterwave_enabled, tax_enabled, rate_limit_per_min";

function boolField(body: Record<string, unknown>, key: string): boolean | undefined {
  if (!(key in body)) return undefined;
  return typeof body[key] === "boolean" ? (body[key] as boolean) : undefined;
}

export async function PATCH(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const storefrontPatch = parseStorefrontClosedPatch(body);
  if (!storefrontPatch.ok && ("maintenance_mode" in b || "storefront_closed_preset" in b || "storefront_closed_copy" in b)) {
    return NextResponse.json({ error: storefrontPatch.error }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof b.store_name === "string" && b.store_name.trim()) {
    update.store_name = b.store_name.trim();
  }

  const maintenanceMode = boolField(b, "maintenance_mode");
  if (maintenanceMode !== undefined) update.maintenance_mode = maintenanceMode;

  if ("storefront_closed_preset" in b) {
    if (!isStorefrontClosedPreset(b.storefront_closed_preset)) {
      return NextResponse.json({ error: "Invalid storefront_closed_preset" }, { status: 400 });
    }
    update.storefront_closed_preset = b.storefront_closed_preset;
  }

  if ("storefront_closed_copy" in b) {
    update.storefront_closed_copy = parseStorefrontClosedCopy(b.storefront_closed_copy);
  }

  for (const key of [
    "payment_moolre_enabled",
    "payment_paystack_enabled",
    "payment_flutterwave_enabled",
    "tax_enabled",
  ] as const) {
    const value = boolField(b, key);
    if (value !== undefined) update[key] = value;
  }

  if (typeof b.rate_limit_per_min === "number" && Number.isFinite(b.rate_limit_per_min)) {
    update.rate_limit_per_min = Math.max(0, Math.round(b.rate_limit_per_min));
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await service
    .from("site_settings")
    .update(update)
    .eq("id", 1)
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not save settings" }, { status: 500 });
  }

  return NextResponse.json({
    ...data,
    feature_flags:
      data.feature_flags && typeof data.feature_flags === "object" && !Array.isArray(data.feature_flags)
        ? data.feature_flags
        : {},
    storefront_closed_copy: parseStorefrontClosedCopy(data.storefront_closed_copy),
  });
}
