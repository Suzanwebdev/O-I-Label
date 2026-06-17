import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  ipAllowed,
  normalizeAccessEmail,
  privateAccessCookieValue,
  storeAccessCookieHeader,
  verifyPrivateAccessPassword,
  clientIp,
} from "@/lib/store-control/access";
import { getStoreSettingsRow } from "@/lib/store-control/server";
import { enforceRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "store-control:private-access", 10);
  if (limited) return limited;

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

  const clientIpAddr = clientIp(request);

  async function logAttempt(success: boolean, method: string | null) {
    try {
      const service = createServiceRoleClient();
      await service.from("store_access_attempts").insert({
        email: emailRaw || null,
        ip: clientIpAddr ?? null,
        success,
        method,
      });
    } catch {
      /* non-fatal */
    }
  }

  if (ipAllowed(clientIpAddr, settings.private_access_ips)) {
    await logAttempt(true, "ip");
    const res = NextResponse.json({ ok: true, method: "ip" });
    res.headers.set("Set-Cookie", storeAccessCookieHeader(privateAccessCookieValue()));
    return res;
  }

  if (password && verifyPrivateAccessPassword(password, settings.private_access_password_hash)) {
    await logAttempt(true, "password");
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

    if (!user?.email) {
      await logAttempt(false, "whitelist");
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const sessionEmail = normalizeAccessEmail(user.email);
    if (sessionEmail !== email) {
      await logAttempt(false, "whitelist");
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const service = createServiceRoleClient();
    const { data: row } = await service
      .from("store_access_whitelist")
      .select("id")
      .ilike("email", sessionEmail)
      .maybeSingle();

    if (row) {
      await logAttempt(true, "whitelist");
      const res = NextResponse.json({ ok: true, method: "whitelist" });
      res.headers.set("Set-Cookie", storeAccessCookieHeader(privateAccessCookieValue()));
      return res;
    }
  }

  await logAttempt(false, password ? "password" : emailRaw ? "whitelist" : null);
  return NextResponse.json({ error: "Access denied." }, { status: 403 });
}
