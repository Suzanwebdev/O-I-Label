import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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

  const userId =
    typeof (body as { userId?: unknown })?.userId === "string" ? (body as { userId: string }).userId.trim() : "";
  const email = typeof (body as { email?: unknown })?.email === "string" ? (body as { email: string }).email.trim() : "";
  const role =
    typeof (body as { role?: unknown })?.role === "string" ? (body as { role: string }).role.trim() : "";

  if (!userId || !email || !role) {
    return NextResponse.json({ error: "userId, email and role are required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  if (role === "superadmin") {
    const { error } = await service
      .from("superadmins")
      .upsert({ user_id: userId, email }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { error } = await service
    .from("admins")
    .upsert({ user_id: userId, email, role }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
