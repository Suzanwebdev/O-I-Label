import { NextResponse } from "next/server";
import { getRequestAuthz, hasMinAdminRole } from "@/lib/authz";
import {
  getStoreControlAdminSnapshot,
  parseStoreControlPatch,
  patchStoreSettings,
} from "@/lib/store-control/server";
import { invalidateStoreControlEdgeCache } from "@/lib/store-control/edge";

export async function GET() {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const snapshot = await getStoreControlAdminSnapshot();
  return NextResponse.json(snapshot);
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

  const parsed = parseStoreControlPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await patchStoreSettings(parsed.patch);
  if (!result) {
    return NextResponse.json({ error: "Could not save store settings" }, { status: 500 });
  }

  invalidateStoreControlEdgeCache();
  return NextResponse.json(result);
}
