import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

type AssignRoleBody = {
  email?: string;
  role?: "superadmin" | "admin" | "staff";
};

async function getUserIdByEmail(email: string) {
  const service = createServiceRoleClient();
  const { data: listed, error: listError } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    return { error: listError.message, userId: null, status: 500 };
  }
  const matched = listed.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!matched) {
    return { error: "No auth user found for this email. User must sign up first.", userId: null, status: 404 };
  }
  return { error: null, userId: matched.id, status: 200 };
}

export async function POST(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!authz.isSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: AssignRoleBody;
  try {
    body = (await request.json()) as AssignRoleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role;
  if (!email || !role) {
    return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
  }
  if (!["superadmin", "admin", "staff"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const userLookup = await getUserIdByEmail(email);
  if (userLookup.error || !userLookup.userId) {
    return NextResponse.json({ error: userLookup.error }, { status: userLookup.status });
  }
  if (userLookup.userId === authz.user.id && role !== "superadmin") {
    return NextResponse.json({ error: "You cannot remove your own superadmin access." }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { error: adminError } = await service.from("admins").upsert(
    {
      user_id: userLookup.userId,
      email,
      role,
    },
    { onConflict: "user_id" }
  );
  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  if (role === "superadmin") {
    const { error: superError } = await service
      .from("superadmins")
      .upsert({ user_id: userLookup.userId, email }, { onConflict: "user_id" });
    if (superError) {
      return NextResponse.json({ error: superError.message }, { status: 500 });
    }
  } else {
    const { error: removeSuperError } = await service
      .from("superadmins")
      .delete()
      .eq("user_id", userLookup.userId);
    if (removeSuperError) {
      return NextResponse.json({ error: removeSuperError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    email,
    role,
    user_id: userLookup.userId,
  });
}

export async function DELETE(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!authz.isSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const userLookup = await getUserIdByEmail(email);
  if (userLookup.error || !userLookup.userId) {
    return NextResponse.json({ error: userLookup.error }, { status: userLookup.status });
  }
  if (userLookup.userId === authz.user.id) {
    return NextResponse.json({ error: "You cannot remove your own access." }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const [{ error: adminDeleteError }, { error: superDeleteError }] = await Promise.all([
    service.from("admins").delete().eq("user_id", userLookup.userId),
    service.from("superadmins").delete().eq("user_id", userLookup.userId),
  ]);
  if (adminDeleteError) {
    return NextResponse.json({ error: adminDeleteError.message }, { status: 500 });
  }
  if (superDeleteError) {
    return NextResponse.json({ error: superDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, user_id: userLookup.userId });
}
