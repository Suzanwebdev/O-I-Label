import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

const PATCHABLE_BOOLEANS = [
  "maintenance_mode",
  "payment_moolre_enabled",
  "payment_paystack_enabled",
  "payment_flutterwave_enabled",
  "tax_enabled",
] as const;

type PatchableBoolean = (typeof PATCHABLE_BOOLEANS)[number];

export async function GET() {
  const authz = await getRequestAuthz();
  if (!authz.isSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      "store_name, maintenance_mode, feature_flags, payment_moolre_enabled, payment_paystack_enabled, payment_flutterwave_enabled, tax_enabled, rate_limit_per_min, updated_at"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Settings not found" }, { status: 404 });
  }

  return NextResponse.json(data);
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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of PATCHABLE_BOOLEANS) {
    const v = (body as Record<string, unknown>)[key];
    if (typeof v === "boolean") {
      updates[key as PatchableBoolean] = v;
    }
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("site_settings")
    .update(updates)
    .eq("id", 1)
    .select(
      "store_name, maintenance_mode, feature_flags, payment_moolre_enabled, payment_paystack_enabled, payment_flutterwave_enabled, tax_enabled, rate_limit_per_min, updated_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
