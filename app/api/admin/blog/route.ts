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
  const excerpt =
    typeof (body as { excerpt?: unknown })?.excerpt === "string" ? (body as { excerpt: string }).excerpt.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Post title is required" }, { status: 400 });
  }

  const slug = toSlug(providedSlug || title);
  if (!slug) {
    return NextResponse.json({ error: "Invalid post slug" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: existing } = await service.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
  }

  const { data, error } = await service
    .from("blog_posts")
    .insert({
      title,
      slug,
      excerpt: excerpt || null,
      body: "New draft",
      published: false,
    })
    .select("id, slug, title, published, published_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
