import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

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

  const title = typeof (body as { title?: unknown })?.title === "string" ? (body as { title: string }).title.trim() : "";
  const providedSlug =
    typeof (body as { slug?: unknown })?.slug === "string" ? (body as { slug: string }).slug.trim() : "";
  const isSmart = Boolean((body as { is_smart?: unknown })?.is_smart);

  if (!title) {
    return NextResponse.json({ error: "Collection title is required" }, { status: 400 });
  }

  const slug = toSlug(providedSlug || title);
  if (!slug) {
    return NextResponse.json({ error: "Invalid collection slug" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: existing } = await service.from("collections").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A collection with this slug already exists" }, { status: 409 });
  }

  const { data, error } = await service
    .from("collections")
    .insert({ title, slug, is_smart: isSmart, smart_rules: isSmart ? {} : null })
    .select("id, title, slug, is_smart, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ collection: data }, { status: 201 });
}

