import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin || !authz.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const variantId =
    typeof (body as { variantId?: unknown })?.variantId === "string"
      ? (body as { variantId: string }).variantId
      : "";
  const stock = Number((body as { stock?: unknown })?.stock);

  if (!variantId) {
    return NextResponse.json({ error: "variantId is required" }, { status: 400 });
  }
  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ error: "stock must be a non-negative number" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: current } = await service.from("variants").select("stock").eq("id", variantId).maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const delta = stock - Number(current.stock ?? 0);

  const { error } = await service.from("variants").update({ stock }).eq("id", variantId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (delta !== 0) {
    await service.from("inventory_movements").insert({
      variant_id: variantId,
      delta,
      reason: "admin_adjustment",
      created_by: authz.user.id,
    });
  }

  return NextResponse.json({ ok: true });
}

