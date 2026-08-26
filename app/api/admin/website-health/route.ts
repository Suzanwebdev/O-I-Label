import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { getWebsiteHealthSnapshot } from "@/lib/website-health/store";

/**
 * Admin-only read API for Website Health operational events.
 * Never returns secrets, emails, tokens, webhook payloads, or stack traces.
 */
export async function GET(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200;
  const snapshot = await getWebsiteHealthSnapshot(limit);
  if (!snapshot.ok) {
    return NextResponse.json({ error: snapshot.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    summary: snapshot.summary,
    events: snapshot.events,
  });
}
