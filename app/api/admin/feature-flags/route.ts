import { NextResponse } from "next/server";
import { getRequestAuthz, hasMinAdminRole } from "@/lib/authz";
import { PUBLIC_CACHE_TAGS, withPublicCacheExpiry } from "@/lib/cache/public-catalogue";
import { createServiceRoleClient } from "@/lib/supabase/server";

async function updateFeatureFlags(request: Request) {
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

  const featureFlags = (body as { featureFlags?: unknown })?.featureFlags;
  if (!featureFlags || typeof featureFlags !== "object" || Array.isArray(featureFlags)) {
    return NextResponse.json({ error: "featureFlags must be a JSON object" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("site_settings")
    .update({ feature_flags: featureFlags, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("feature_flags")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ featureFlags: data.feature_flags });
}

export const PATCH = withPublicCacheExpiry(updateFeatureFlags, [PUBLIC_CACHE_TAGS.featureFlags]);
