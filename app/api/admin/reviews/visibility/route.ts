import { NextResponse } from "next/server";
import { getRequestAuthz, hasMinAdminRole } from "@/lib/authz";
import {
  getMergedFeatureFlags,
  setReviewsFeatureEnabled,
} from "@/lib/reviews/feature";

export async function GET() {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const flags = await getMergedFeatureFlags();
  return NextResponse.json({ ok: true, enabled: Boolean(flags.reviews) });
}

export async function PATCH(request: Request) {
  const authz = await getRequestAuthz();
  if (!hasMinAdminRole(authz, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const enabled = (body as { enabled?: unknown })?.enabled;
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  try {
    const flags = await setReviewsFeatureEnabled(enabled);
    return NextResponse.json({ ok: true, enabled: Boolean(flags.reviews) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update reviews visibility." },
      { status: 500 }
    );
  }
}
