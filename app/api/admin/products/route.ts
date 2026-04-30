import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ProductBadge } from "@/lib/types";

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

const allowedBadges = new Set<ProductBadge>([
  "new",
  "best_seller",
  "limited",
  "sale",
  "selling_fast",
  "trending",
]);
const allowedOccasions = new Set(["birthday", "vacation", "wedding", "corporate"]);

type VariantInput = {
  size: string | null;
  color: string | null;
  sku: string;
  price: number;
  compareAt: number | null;
  stock: number;
};

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
  const seoTitle =
    typeof (body as { seoTitle?: unknown })?.seoTitle === "string"
      ? (body as { seoTitle: string }).seoTitle.trim()
      : "";
  const seoDescription =
    typeof (body as { seoDescription?: unknown })?.seoDescription === "string"
      ? (body as { seoDescription: string }).seoDescription.trim()
      : "";
  const categoryId =
    typeof (body as { categoryId?: unknown })?.categoryId === "string"
      ? (body as { categoryId: string }).categoryId.trim()
      : "";
  const isActive = Boolean((body as { isActive?: unknown })?.isActive);
  const badgesRaw = Array.isArray((body as { badges?: unknown })?.badges)
    ? ((body as { badges: unknown[] }).badges as unknown[])
    : [];
  const badges = badgesRaw
    .filter((b): b is ProductBadge => typeof b === "string" && allowedBadges.has(b as ProductBadge))
    .slice(0, 6);
  const imagePathsRaw = Array.isArray((body as { imagePaths?: unknown })?.imagePaths)
    ? ((body as { imagePaths: unknown[] }).imagePaths as unknown[])
    : [];
  const imagePaths = imagePathsRaw
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 20);
  const occasionsRaw = Array.isArray((body as { occasions?: unknown })?.occasions)
    ? ((body as { occasions: unknown[] }).occasions as unknown[])
    : [];
  const occasions = occasionsRaw
    .filter((o): o is string => typeof o === "string" && allowedOccasions.has(o))
    .slice(0, 8);
  const videoUrlsRaw = Array.isArray((body as { videoUrls?: unknown })?.videoUrls)
    ? ((body as { videoUrls: unknown[] }).videoUrls as unknown[])
    : [];
  const videoUrls = videoUrlsRaw
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter((u) => {
      if (!u.startsWith("https://")) return false;
      try {
        return Boolean(new URL(u).hostname);
      } catch {
        return false;
      }
    })
    .slice(0, 8);
  const variantsRaw = Array.isArray((body as { variants?: unknown })?.variants)
    ? ((body as { variants: unknown[] }).variants as unknown[])
    : [];
  const variants: VariantInput[] = variantsRaw
    .map((v) => v as Record<string, unknown>)
    .map((v) => ({
      size: typeof v.size === "string" && v.size.trim() ? v.size.trim() : null,
      color: typeof v.color === "string" && v.color.trim() ? v.color.trim() : null,
      sku: typeof v.sku === "string" ? v.sku.trim() : "",
      price: Number(v.price),
      compareAt: v.compareAt == null || v.compareAt === "" ? null : Number(v.compareAt),
      stock: Number(v.stock),
    }));

  if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Category is required" }, { status: 400 });
  if (!variants.length) {
    return NextResponse.json({ error: "At least one variant is required" }, { status: 400 });
  }
  const mappedWithAutoSku = variants.map((v, idx) => ({
    ...v,
    sku: v.sku || makeSku(`${name}-${idx + 1}`),
  }));
  const hasInvalidVariant = mappedWithAutoSku.some(
    (v) =>
      !v.sku ||
      !Number.isFinite(v.price) ||
      v.price <= 0 ||
      !Number.isFinite(v.stock) ||
      v.stock < 0 ||
      (v.compareAt != null && (!Number.isFinite(v.compareAt) || v.compareAt <= 0))
  );
  if (hasInvalidVariant) {
    return NextResponse.json({ error: "Each variant requires valid SKU, price, and stock" }, { status: 400 });
  }
  const normalizedSku = mappedWithAutoSku.map((v) => v.sku.toLowerCase());
  if (new Set(normalizedSku).size !== normalizedSku.length) {
    return NextResponse.json({ error: "Variant SKUs must be unique" }, { status: 400 });
  }

  const slug = toSlug(providedSlug || name);
  if (!slug) return NextResponse.json({ error: "Invalid product slug" }, { status: 400 });

  const service = createServiceRoleClient();

  const { data: existingSlug } = await service.from("products").select("id").eq("slug", slug).maybeSingle();
  if (existingSlug) {
    return NextResponse.json({ error: "A product with this slug already exists" }, { status: 409 });
  }
  const skusToCheck = mappedWithAutoSku.map((v) => v.sku);
  const { data: existingSkuRows } = await service.from("variants").select("sku").in("sku", skusToCheck);
  if ((existingSkuRows ?? []).length > 0) {
    return NextResponse.json({ error: "One or more variant SKUs already exist" }, { status: 409 });
  }

  const { data: product, error: productError } = await service
    .from("products")
    .insert({
      name,
      slug,
      description: description || null,
      category_id: categoryId,
      is_active: isActive,
      badges,
      occasions,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      video_urls: videoUrls,
    })
    .select("id")
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: productError?.message ?? "Could not create product" }, { status: 500 });
  }

  const mappedVariants = mappedWithAutoSku.map((v) => ({
    product_id: product.id,
    sku: v.sku,
    price_ghs: v.price,
    compare_at_ghs: v.compareAt,
    stock: v.stock,
    size: v.size,
    color: v.color,
  }));
  const { data: insertedVariants, error: variantError } = await service
    .from("variants")
    .insert(mappedVariants)
    .select("id, stock");

  if (variantError) {
    await service.from("products").delete().eq("id", product.id);
    return NextResponse.json({ error: variantError.message }, { status: 500 });
  }

  if ((insertedVariants ?? []).length) {
    const movementRows = insertedVariants
      .filter((v) => Number(v.stock) > 0)
      .map((v) => ({
        variant_id: v.id,
        delta: Number(v.stock),
        reason: "initial_stock",
        created_by: authz.user?.id ?? null,
      }));
    if (movementRows.length) {
      await service.from("inventory_movements").insert(movementRows);
    }
  }

  if (imagePaths.length) {
    await service.from("product_images").insert(
      imagePaths.map((path, idx) => ({
        product_id: product.id,
        storage_path: path,
        sort_order: idx,
        alt: name,
      }))
    );
  }

  return NextResponse.json({ ok: true, productId: product.id }, { status: 201 });
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

  const productId =
    typeof (body as { productId?: unknown })?.productId === "string"
      ? (body as { productId: string }).productId.trim()
      : "";
  const occasionsRaw = Array.isArray((body as { occasions?: unknown })?.occasions)
    ? ((body as { occasions: unknown[] }).occasions as unknown[])
    : [];
  const occasions = occasionsRaw.filter(
    (o): o is "birthday" | "vacation" | "wedding" | "corporate" =>
      typeof o === "string" && (o === "birthday" || o === "vacation" || o === "wedding" || o === "corporate")
  );

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from("products")
    .update({ occasions })
    .eq("id", productId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

