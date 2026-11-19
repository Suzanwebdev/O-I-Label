import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { PUBLIC_CACHE_TAGS, withPublicCacheExpiry } from "@/lib/cache/public-catalogue";
import {
  BEST_SELLERS_PRODUCT_ORDER_KEY,
  parseBestSellersProductOrder,
} from "@/lib/home/homepage-product-order";
import { createServiceRoleClient } from "@/lib/supabase/server";

function normalizeOrderedIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") return null;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    orderedIds.push(id);
  }
  return orderedIds;
}

export async function GET() {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service.from("home_content").select("sections").eq("id", 1).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sections =
    data?.sections && typeof data.sections === "object" && !Array.isArray(data.sections)
      ? (data.sections as Record<string, unknown>)
      : {};

  return NextResponse.json({ orderedIds: parseBestSellersProductOrder(sections) });
}

async function updateHomepageProductOrder(request: Request) {
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

  const orderedIds = normalizeOrderedIds((body as { orderedIds?: unknown })?.orderedIds);
  if (!orderedIds || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: row, error: fetchErr } = await service
    .from("home_content")
    .select("sections")
    .eq("id", 1)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const current =
    row?.sections && typeof row.sections === "object" && !Array.isArray(row.sections)
      ? (row.sections as Record<string, unknown>)
      : {};

  const sections = {
    ...current,
    [BEST_SELLERS_PRODUCT_ORDER_KEY]: orderedIds,
  };

  const { error } = await service
    .from("home_content")
    .update({ sections, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true, orderedIds });
}

export const PATCH = withPublicCacheExpiry(updateHomepageProductOrder, [PUBLIC_CACHE_TAGS.homeContent]);
