import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  getStorefrontClosedSettings,
  parseStorefrontClosedPatch,
  patchStorefrontClosedSettings,
} from "@/lib/storefront-closed-server";

export async function GET() {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getStorefrontClosedSettings();
  if (!settings) {
    return NextResponse.json({ error: "Store settings not found" }, { status: 404 });
  }

  return NextResponse.json(settings);
}

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

  const parsed = parseStorefrontClosedPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await patchStorefrontClosedSettings(parsed.patch);
  if (!updated) {
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }

  return NextResponse.json(updated);
}
