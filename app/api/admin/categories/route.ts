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

  const name = typeof (body as { name?: unknown })?.name === "string" ? (body as { name: string }).name.trim() : "";
  const providedSlug =
    typeof (body as { slug?: unknown })?.slug === "string" ? (body as { slug: string }).slug.trim() : "";
  const description =
    typeof (body as { description?: unknown })?.description === "string"
      ? (body as { description: string }).description.trim()
      : null;

  if (!name) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  const slug = toSlug(providedSlug || name);
  if (!slug) {
    return NextResponse.json({ error: "Invalid category slug" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: existing } = await service.from("categories").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A category with this slug already exists" }, { status: 409 });
  }

  const { data, error } = await service
    .from("categories")
    .insert({ name, slug, description, image_url: null })
    .select("id, name, slug, description, image_url, sort_order")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data }, { status: 201 });
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

  const categoryId =
    typeof (body as { categoryId?: unknown })?.categoryId === "string"
      ? (body as { categoryId: string }).categoryId.trim()
      : "";
  const name = typeof (body as { name?: unknown })?.name === "string" ? (body as { name: string }).name.trim() : undefined;
  const imageUrl =
    typeof (body as { imageUrl?: unknown })?.imageUrl === "string"
      ? (body as { imageUrl: string }).imageUrl.trim()
      : undefined;
  const description =
    typeof (body as { description?: unknown })?.description === "string"
      ? (body as { description: string }).description.trim()
      : undefined;

  if (!categoryId) {
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name || null;
  if (imageUrl !== undefined) update.image_url = imageUrl || null;
  if (description !== undefined) update.description = description || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { error } = await service.from("categories").update(update).eq("id", categoryId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
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

  const categoryId =
    typeof (body as { categoryId?: unknown })?.categoryId === "string"
      ? (body as { categoryId: string }).categoryId.trim()
      : "";
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { count: linkedProducts } = await service
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if ((linkedProducts ?? 0) > 0) {
    return NextResponse.json(
      { error: "Cannot delete category with linked products. Move products first." },
      { status: 409 }
    );
  }

  const { error } = await service.from("categories").delete().eq("id", categoryId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

