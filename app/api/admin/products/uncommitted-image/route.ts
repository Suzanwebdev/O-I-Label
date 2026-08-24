import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { PRODUCT_IMAGES_BUCKET, isCatalogObjectPath } from "@/lib/media/catalog-storage-path";
import {
  deleteUncommittedCatalogImage,
  type UncommittedImageStore,
} from "@/lib/media/uncommitted-product-image";
import { createServiceRoleClient } from "@/lib/supabase/server";

function supabaseUncommittedStore(): UncommittedImageStore {
  const service = createServiceRoleClient();
  return {
    async findProductImageStoragePaths(candidates) {
      if (!candidates.length) return [];
      const { data, error } = await service
        .from("product_images")
        .select("storage_path")
        .in("storage_path", candidates);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((row) => row.storage_path)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
    },
    async removeCatalogObject(path) {
      if (!isCatalogObjectPath(path)) {
        return { ok: false, error: "Refusing to delete a non-catalog path." };
      }
      const { error } = await service.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("not found") || msg.includes("404")) {
          return { ok: true };
        }
        return { ok: false, error: "The new upload could not be deleted from storage. Please try again." };
      }
      return { ok: true };
    },
  };
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

  const url = typeof (body as { url?: unknown })?.url === "string" ? (body as { url: string }).url : "";
  if (!url.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  try {
    const result = await deleteUncommittedCatalogImage(url, supabaseUncommittedStore(), supabaseUrl);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, path: result.path });
  } catch {
    return NextResponse.json(
      { error: "The new upload could not be deleted from storage. Please try again." },
      { status: 500 }
    );
  }
}
