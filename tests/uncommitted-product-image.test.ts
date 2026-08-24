import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCatalogObjectPath,
  parseCatalogObjectPath,
  productImageRowReferencesCatalogPath,
} from "../lib/media/catalog-storage-path.ts";
import {
  decideUncommittedImageRemove,
  deleteUncommittedCatalogImage,
  type UncommittedImageStore,
} from "../lib/media/uncommitted-product-image.ts";

const ORIGIN = "https://proj.supabase.co";
const PATH = "catalog/1710000000000-ab12cd34-Look_01.webp";
const URL = `${ORIGIN}/storage/v1/object/public/product-images/${PATH}`;

function memoryStore(opts?: {
  referenced?: string[];
  removeError?: string;
}): { store: UncommittedImageStore; removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    store: {
      async findProductImageStoragePaths(candidates) {
        return (opts?.referenced ?? []).filter((row) => candidates.includes(row));
      },
      async removeCatalogObject(path) {
        if (opts?.removeError) return { ok: false, error: opts.removeError };
        removed.push(path);
        return { ok: true };
      },
    },
  };
}

describe("catalog object path parsing", () => {
  it("accepts a public catalog URL on the project host", () => {
    assert.equal(parseCatalogObjectPath(URL, ORIGIN), PATH);
    assert.equal(isCatalogObjectPath(PATH), true);
  });

  it("rejects unrelated buckets, prefixes, hosts, and traversal", () => {
    assert.equal(parseCatalogObjectPath("homepage/hero/1.png", ORIGIN), null);
    assert.equal(
      parseCatalogObjectPath(
        `${ORIGIN}/storage/v1/object/public/product-images/homepage/hero/1.png`,
        ORIGIN
      ),
      null
    );
    assert.equal(
      parseCatalogObjectPath(
        `${ORIGIN}/storage/v1/object/public/product-images/catalog/../secret.webp`,
        ORIGIN
      ),
      null
    );
    assert.equal(
      parseCatalogObjectPath(
        "https://evil.example/storage/v1/object/public/product-images/" + PATH,
        ORIGIN
      ),
      null
    );
    assert.equal(parseCatalogObjectPath("catalog/foo/bar.webp", ORIGIN), null);
  });
});

describe("uncommitted product image tracking", () => {
  it("tracks a newly uploaded URL as uncommitted", () => {
    const uncommitted = new Set<string>();
    uncommitted.add(URL);
    assert.equal(uncommitted.has(URL), true);
    const decision = decideUncommittedImageRemove({
      url: URL,
      uncommittedUrls: uncommitted,
      remainingUrls: [],
      supabaseUrl: ORIGIN,
    });
    assert.deepEqual(decision, { action: "storage-delete", path: PATH });
  });

  it("targets only that Storage object when the new image is removed before Save", () => {
    const other = `${ORIGIN}/storage/v1/object/public/product-images/catalog/999-zz-keep.webp`;
    const decision = decideUncommittedImageRemove({
      url: URL,
      uncommittedUrls: new Set([URL, other]),
      remainingUrls: [other],
      supabaseUrl: ORIGIN,
    });
    assert.equal(decision.action, "storage-delete");
    if (decision.action === "storage-delete") {
      assert.equal(decision.path, PATH);
      assert.notEqual(decision.path.includes("999-zz-keep"), true);
    }
  });

  it("does not delete an existing product image removed from the UI", () => {
    const existing = URL;
    const decision = decideUncommittedImageRemove({
      url: existing,
      uncommittedUrls: new Set(),
      remainingUrls: [],
      supabaseUrl: ORIGIN,
    });
    assert.deepEqual(decision, { action: "ui-only" });
  });

  it("does not delete a new image that remains after a successful save (no longer uncommitted)", () => {
    const afterSave = new Set<string>();
    const decision = decideUncommittedImageRemove({
      url: URL,
      uncommittedUrls: afterSave,
      remainingUrls: [URL],
      supabaseUrl: ORIGIN,
    });
    assert.deepEqual(decision, { action: "ui-only" });
  });
});

describe("uncommitted catalog storage delete", () => {
  it("refuses an invalid or untrusted path and does not call remove", async () => {
    const { store, removed } = memoryStore();
    const evil = await deleteUncommittedCatalogImage(
      `${ORIGIN}/storage/v1/object/public/product-images/homepage/hero/x.png`,
      store,
      ORIGIN
    );
    assert.equal(evil.ok, false);
    if (!evil.ok) assert.equal(evil.status, 400);
    assert.deepEqual(removed, []);

    const traversal = await deleteUncommittedCatalogImage("catalog/../secret.webp", store, ORIGIN);
    assert.equal(traversal.ok, false);
    assert.deepEqual(removed, []);
  });

  it("does not delete when the path is already referenced by product_images", async () => {
    const { store, removed } = memoryStore({ referenced: [URL] });
    const result = await deleteUncommittedCatalogImage(URL, store, ORIGIN);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 409);
      assert.match(result.error, /saved on a product/i);
    }
    assert.deepEqual(removed, []);
    assert.equal(productImageRowReferencesCatalogPath(URL, PATH, ORIGIN), true);
  });

  it("deletes only the uncommitted catalog object when it is not referenced", async () => {
    const { store, removed } = memoryStore();
    const result = await deleteUncommittedCatalogImage(URL, store, ORIGIN);
    assert.deepEqual(result, { ok: true, path: PATH });
    assert.deepEqual(removed, [PATH]);
  });

  it("does not pretend success when Storage deletion fails", async () => {
    const { store, removed } = memoryStore({ removeError: "The new upload could not be deleted from storage. Please try again." });
    const result = await deleteUncommittedCatalogImage(URL, store, ORIGIN);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 500);
      assert.match(result.error, /could not be deleted/i);
    }
    assert.deepEqual(removed, []);
  });

  it("leaves existing product images untouched", async () => {
    const existingPath = "catalog/111-old-saved.webp";
    const existingUrl = `${ORIGIN}/storage/v1/object/public/product-images/${existingPath}`;
    const { store, removed } = memoryStore({ referenced: [existingUrl] });
    const result = await deleteUncommittedCatalogImage(existingUrl, store, ORIGIN);
    assert.equal(result.ok, false);
    assert.deepEqual(removed, []);
  });
});
