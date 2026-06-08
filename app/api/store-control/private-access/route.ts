import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  ipAllowed,
  normalizeAccessEmail,
  privateAccessCookieValue,
  storeAccessCookieHeader,
  verifyPrivateAccessPassword,
} from "@/lib/store-control/access";
import { getStoreSettingsRow } from "@/lib/store-control/server";

export async function POST(request: Request) {
  const settings = await getStoreSettingsRow();
  if (!settings || settings.store_status !== "private_access") {
    return NextResponse.json({ error: "Private access is not active." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";
  const emailRaw =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email
      : "";

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");
  if (ipAllowed(clientIp, settings.private_access_ips)) {
    const res = NextResponse.json({ ok: true, method: "ip" });
    res.headers.set("Set-Cookie", storeAccessCookieHeader(privateAccessCookieValue()));
    return res;
  }

  if (password && verifyPrivateAccessPassword(password, settings.private_access_password_hash)) {
    const res = NextResponse.json({ ok: true, method: "password" });
    res.headers.set("Set-Cookie", storeAccessCookieHeader(privateAccessCookieValue()));
    return res;
  }

  if (emailRaw) {
    const email = normalizeAccessEmail(emailRaw);
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const sessionEmail = user?.email ? normalizeAccessEmail(user.email) : null;
    const checkEmail = sessionEmail ?? email;

    const service = createServiceRoleClient();
    const { data: row } = await service
      .from("store_access_whitelist")
      .select("id")
      .ilike("email", checkEmail)
      .maybeSingle();

    if (row) {
      const res = NextResponse.json({ ok: true, method: "whitelist" });
      res.headers.set("Set-Cookie", storeAccessCookieHeader(privateAccessCookieValue()));
      return res;
    }
  }

  return NextResponse.json({ error: "Access denied." }, { status: 403 });
}
