import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderedIds = Array.isArray((body as { orderedIds?: unknown })?.orderedIds)
    ? ((body as { orderedIds: unknown[] }).orderedIds as unknown[]).filter(
        (v): v is string => typeof v === "string" && v.length > 0
      )
    : [];
  if (!orderedIds.length) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await service
      .from("categories")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
