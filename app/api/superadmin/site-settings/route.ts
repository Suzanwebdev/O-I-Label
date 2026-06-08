import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { invalidateStoreControlEdgeCache } from "@/lib/store-control/edge";
import { recommendedFlagsForStatus } from "@/lib/store-control/constants";

const SELECT =
  "store_name, maintenance_mode, feature_flags, payment_moolre_enabled, payment_paystack_enabled, payment_flutterwave_enabled, tax_enabled, rate_limit_per_min";

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
  const service = createServiceRoleClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof b.store_name === "string" && b.store_name.trim()) {
    update.store_name = b.store_name.trim();
  }

  const maintenanceMode = boolField(b, "maintenance_mode");
  if (maintenanceMode !== undefined) {
    update.maintenance_mode = maintenanceMode;
    const flags = recommendedFlagsForStatus(maintenanceMode ? "maintenance" : "live");
    await service
      .from("store_settings")
      .update({
        store_status: maintenanceMode ? "maintenance" : "live",
        browsing_enabled: flags.browsing_enabled,
        checkout_enabled: flags.checkout_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    invalidateStoreControlEdgeCache();
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
  });
}
