import { NextResponse } from "next/server";
import { getRequestAuthz, hasMinAdminRole } from "@/lib/authz";
import {
  getStoreControlAdminSnapshot,
  parseStoreControlPatch,
  patchStoreSettings,
  STORE_STATE_UNAVAILABLE_RETRY_SECONDS,
} from "@/lib/store-control/server";
import { invalidateStoreControlEdgeCache } from "@/lib/store-control/edge";
import { PUBLIC_CACHE_TAGS, withPublicCacheExpiry } from "@/lib/cache/public-catalogue";

export async function GET() {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const snapshot = await getStoreControlAdminSnapshot();
  return NextResponse.json(snapshot);
}

async function updateStoreControl(request: Request) {
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

  const result = await patchStoreSettings(parsed.patch, { expectedUpdatedAt: parsed.expectedUpdatedAt });
  if (result.ok || result.settled) invalidateStoreControlEdgeCache();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      {
        status: result.status,
        headers: result.status === 503 ? { "Retry-After": String(STORE_STATE_UNAVAILABLE_RETRY_SECONDS) } : undefined,
      }
    );
  }

  return NextResponse.json({ settings: result.settings, control: result.control });
}

// Going live also disables banners, so both public store-control tags expire.
export const PATCH = withPublicCacheExpiry(updateStoreControl, [
  PUBLIC_CACHE_TAGS.storeSettings,
  PUBLIC_CACHE_TAGS.storeBanners,
]);
