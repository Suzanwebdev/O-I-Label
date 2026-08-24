import {
  catalogObjectPublicUrl,
  isCatalogObjectPath,
  parseCatalogObjectPath,
  productImageRowReferencesCatalogPath,
} from "@/lib/media/catalog-storage-path";

export type UncommittedRemoveDecision =
  | { action: "storage-delete"; path: string }
  | { action: "ui-only" }
  | { action: "refuse"; error: string };

/**
 * Session-only: Storage delete is allowed only for URLs this editor uploaded
 * and that will not remain in the gallery list.
 */
export function decideUncommittedImageRemove(opts: {
  url: string;
  uncommittedUrls: ReadonlySet<string>;
  remainingUrls: string[];
  supabaseUrl?: string | null;
}): UncommittedRemoveDecision {
  const url = opts.url.trim();
  if (!url) return { action: "ui-only" };

  if (!opts.uncommittedUrls.has(url) || opts.remainingUrls.includes(url)) {
    return { action: "ui-only" };
  }

  const path = parseCatalogObjectPath(url, opts.supabaseUrl ?? undefined);
  if (!path) {
    return {
      action: "refuse",
      error: "That file could not be verified as a new catalog upload, so it was not deleted.",
    };
  }

  return { action: "storage-delete", path };
}

export type UncommittedImageStore = {
  findProductImageStoragePaths: (candidates: string[]) => Promise<string[]>;
  removeCatalogObject: (path: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export type DeleteUncommittedResult =
  | { ok: true; path: string }
  | { ok: false; error: string; status: number };

/**
 * Server-side delete for one uncommitted catalog object.
 * Never deletes if any product_images row still references the path.
 */
export async function deleteUncommittedCatalogImage(
  inputUrl: string,
  store: UncommittedImageStore,
  supabaseUrl: string | null
): Promise<DeleteUncommittedResult> {
  const path = parseCatalogObjectPath(inputUrl, supabaseUrl);
  if (!path || !isCatalogObjectPath(path)) {
    return { ok: false, status: 400, error: "That is not a valid catalog image path." };
  }

  const candidates = [path];
  if (supabaseUrl) {
    const publicUrl = catalogObjectPublicUrl(path, supabaseUrl);
    if (publicUrl) candidates.push(publicUrl);
  }

  const rows = await store.findProductImageStoragePaths(candidates);
  const referenced = rows.some((stored) =>
    productImageRowReferencesCatalogPath(stored, path, supabaseUrl)
  );
  if (referenced) {
    return {
      ok: false,
      status: 409,
      error: "This image is saved on a product and was not deleted.",
    };
  }

  const removed = await store.removeCatalogObject(path);
  if (!removed.ok) {
    return { ok: false, status: 500, error: removed.error };
  }

  return { ok: true, path };
}
