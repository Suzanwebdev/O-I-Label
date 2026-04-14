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

function makeSku(base: string) {
  const stamp = Date.now().toString().slice(-6);
  return `${base.toUpperCase().slice(0, 8)}-${stamp}`;
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
      : "";
  const categoryId =
    typeof (body as { categoryId?: unknown })?.categoryId === "string"
      ? (body as { categoryId: string }).categoryId.trim()
      : "";
  const price = Number((body as { price?: unknown })?.price);
  const stock = Number((body as { stock?: unknown })?.stock);
  const compareAtRaw = (body as { compareAt?: unknown })?.compareAt;
  const compareAt = compareAtRaw === "" || compareAtRaw == null ? null : Number(compareAtRaw);
  const providedSku =
    typeof (body as { sku?: unknown })?.sku === "string" ? (body as { sku: string }).sku.trim() : "";

  if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Category is required" }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Price must be greater than 0" }, { status: 400 });
  }
  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ error: "Stock must be a non-negative number" }, { status: 400 });
  }
  if (compareAt != null && (!Number.isFinite(compareAt) || compareAt <= 0)) {
    return NextResponse.json({ error: "Compare-at price must be positive" }, { status: 400 });
  }

  const slug = toSlug(providedSlug || name);
  if (!slug) return NextResponse.json({ error: "Invalid product slug" }, { status: 400 });
  const sku = providedSku || makeSku(slug);

  const service = createServiceRoleClient();

  const { data: existingSlug } = await service.from("products").select("id").eq("slug", slug).maybeSingle();
  if (existingSlug) {
    return NextResponse.json({ error: "A product with this slug already exists" }, { status: 409 });
  }
  const { data: existingSku } = await service.from("variants").select("id").eq("sku", sku).maybeSingle();
  if (existingSku) {
    return NextResponse.json({ error: "A variant with this SKU already exists" }, { status: 409 });
  }

  const { data: product, error: productError } = await service
    .from("products")
    .insert({
      name,
      slug,
      description: description || null,
      category_id: categoryId,
      is_active: true,
    })
    .select("id")
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: productError?.message ?? "Could not create product" }, { status: 500 });
  }

  const { error: variantError } = await service.from("variants").insert({
    product_id: product.id,
    sku,
    price_ghs: price,
    compare_at_ghs: compareAt,
    stock,
    size: null,
    color: null,
  });

  if (variantError) {
    await service.from("products").delete().eq("id", product.id);
    return NextResponse.json({ error: variantError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, productId: product.id }, { status: 201 });
}

