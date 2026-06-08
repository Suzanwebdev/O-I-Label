import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { invalidateStoreControlEdgeCache } from "@/lib/store-control/edge";

export async function POST(request: Request) {
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

  const b = body as { text?: unknown; href?: unknown; enabled?: unknown; starts_at?: unknown; ends_at?: unknown };
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Banner text is required" }, { status: 400 });

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("store_banners")
    .insert({
      text,
      href: typeof b.href === "string" && b.href.trim() ? b.href.trim() : null,
      enabled: typeof b.enabled === "boolean" ? b.enabled : true,
      starts_at: typeof b.starts_at === "string" ? b.starts_at : null,
      ends_at: typeof b.ends_at === "string" ? b.ends_at : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not create banner" }, { status: 500 });
  }

  invalidateStoreControlEdgeCache();
  return NextResponse.json({ banner: data });
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

  const b = body as {
    id?: unknown;
    text?: unknown;
    href?: unknown;
    enabled?: unknown;
    starts_at?: unknown;
    ends_at?: unknown;
  };
  const id = typeof b.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ error: "Banner id is required" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.text === "string") update.text = b.text.trim();
  if ("href" in b) update.href = typeof b.href === "string" && b.href.trim() ? b.href.trim() : null;
  if (typeof b.enabled === "boolean") update.enabled = b.enabled;
  if ("starts_at" in b) update.starts_at = typeof b.starts_at === "string" ? b.starts_at : null;
  if ("ends_at" in b) update.ends_at = typeof b.ends_at === "string" ? b.ends_at : null;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("store_banners")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not update banner" }, { status: 500 });
  }

  invalidateStoreControlEdgeCache();
  return NextResponse.json({ banner: data });
}

export async function DELETE(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "Banner id is required" }, { status: 400 });

  const service = createServiceRoleClient();
  const { error } = await service.from("store_banners").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateStoreControlEdgeCache();
  return NextResponse.json({ ok: true });
}
