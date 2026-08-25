/**
 * Phase 8B — read-only Storage orphan audit (local operator only).
 *
 *   node ./node_modules/tsx/dist/cli.mjs scripts/storage-orphan-audit.ts
 *
 * Performs ZERO Storage deletes, ZERO database writes, ZERO metadata changes.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local supported).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_IMAGES_BUCKET,
  parseCatalogObjectPath,
} from "../lib/media/catalog-storage-path";

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;

type StorageObjectRecord = {
  path: string;
  sizeBytes: number | null;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type OrphanCategory =
  | "referenced"
  | "phase7_old_original"
  | "pre_existing_catalog_orphan"
  | "non_catalog_unreferenced"
  | "ambiguous";

type AuditCandidate = {
  storagePath: string;
  sizeBytes: number | null;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  category: OrphanCategory;
  referencedByProductImages: boolean;
  databaseReferences: string[];
  reason: string;
  phase7MigrationLogMatch: {
    matched: boolean;
    logFile: string | null;
    rowId: string | null;
    oldPath: string | null;
    newPath: string | null;
    migratedAt: string | null;
  } | null;
};

type Phase7LogEntry = {
  logFile: string;
  rowId: string;
  oldPath: string;
  newPath: string | null;
  migratedAt: string | null;
};

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function hasUnsafePathChars(value: string): boolean {
  return (
    value.includes("..") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.includes("%2e") ||
    value.includes("%2E") ||
    value.includes("%2f") ||
    value.includes("%2F") ||
    value.includes("%5c") ||
    value.includes("%5C")
  );
}

/** Extract any product-images object path from a public URL or raw bucket-relative path. */
export function parseProductImageObjectPath(
  input: string,
  supabaseUrl?: string | null
): string | null {
  const trimmed = input.trim();
  if (!trimmed || hasUnsafePathChars(trimmed)) return null;

  if (!trimmed.includes("://") && !trimmed.startsWith("/")) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(trimmed) || trimmed.startsWith("/")) return null;
    return trimmed.replace(/^\//, "");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  if (supabaseUrl) {
    try {
      const expected = new URL(supabaseUrl).origin;
      if (url.origin !== expected) return null;
    } catch {
      return null;
    }
  }

  const markerAt = url.pathname.indexOf(PUBLIC_OBJECT_PREFIX);
  if (markerAt === -1) return null;

  let objectPath: string;
  try {
    objectPath = decodeURIComponent(url.pathname.slice(markerAt + PUBLIC_OBJECT_PREFIX.length));
  } catch {
    return null;
  }

  if (!objectPath || hasUnsafePathChars(objectPath) || objectPath.includes("//")) return null;
  if (!/^[a-zA-Z0-9_./-]+$/.test(objectPath)) return null;
  return objectPath;
}

function isCatalogPath(path: string): boolean {
  return parseCatalogObjectPath(path) !== null || path.startsWith("catalog/");
}

function extractUrlsFromJson(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    if (
      value.includes("/storage/v1/object/public/product-images/") ||
      value.startsWith("catalog/") ||
      value.startsWith("homepage/") ||
      value.startsWith("occasions/") ||
      value.startsWith("categories/") ||
      value.startsWith("store-control/")
    ) {
      out.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractUrlsFromJson(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      extractUrlsFromJson(v, out);
    }
  }
}

async function listBucketRecursive(
  supabase: SupabaseClient,
  prefix = ""
): Promise<StorageObjectRecord[]> {
  const results: StorageObjectRecord[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Storage list failed for prefix "${prefix}": ${error.message}`);

    if (!data?.length) break;

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      const isFolder = item.id == null;
      if (isFolder) {
        results.push(...(await listBucketRecursive(supabase, itemPath)));
      } else {
        const meta = (item.metadata ?? {}) as Record<string, unknown>;
        const sizeRaw = meta.size ?? meta.contentLength;
        results.push({
          path: itemPath,
          sizeBytes: typeof sizeRaw === "number" ? sizeRaw : Number(sizeRaw) || null,
          mimeType: typeof meta.mimetype === "string" ? meta.mimetype : null,
          createdAt: item.created_at ?? null,
          updatedAt: item.updated_at ?? null,
        });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return results;
}

function loadPhase7MigrationEntries(logsDir: string): Map<string, Phase7LogEntry> {
  const byOldPath = new Map<string, Phase7LogEntry>();
  if (!existsSync(logsDir)) return byOldPath;

  for (const file of readdirSync(logsDir)) {
    if (!file.startsWith("catalog-image-migration-") || !file.endsWith(".json")) continue;
    if (file.includes("dry-run")) continue;
    const fullPath = join(logsDir, file);
    let parsed: { results?: Array<Record<string, unknown>> };
    try {
      parsed = JSON.parse(readFileSync(fullPath, "utf8"));
    } catch {
      continue;
    }
    for (const row of parsed.results ?? []) {
      if (row.status !== "migrated") continue;
      const oldPath = typeof row.oldPath === "string" ? row.oldPath : null;
      const rowId = typeof row.rowId === "string" ? row.rowId : null;
      if (!oldPath || !rowId) continue;
      byOldPath.set(oldPath, {
        logFile: file,
        rowId,
        oldPath,
        newPath: typeof row.newPath === "string" ? row.newPath : null,
        migratedAt: typeof row.at === "string" ? row.at : null,
      });
    }
  }

  return byOldPath;
}

async function fetchAllProductImagePaths(supabase: SupabaseClient): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("product_images")
      .select("storage_path")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`product_images query failed: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      if (typeof row.storage_path === "string" && row.storage_path.trim()) {
        paths.push(row.storage_path.trim());
      }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return paths;
}

async function fetchSecondaryReferenceStrings(supabase: SupabaseClient): Promise<Map<string, string[]>> {
  const refs = new Map<string, Set<string>>();

  function addRef(objectPath: string, source: string): void {
    if (!objectPath) return;
    const set = refs.get(objectPath) ?? new Set<string>();
    set.add(source);
    refs.set(objectPath, set);
  }

  const { data: categories, error: catErr } = await supabase
    .from("categories")
    .select("id, image_url");
  if (catErr) throw new Error(`categories query failed: ${catErr.message}`);
  for (const row of categories ?? []) {
    if (typeof row.image_url === "string") {
      addRef(parseProductImageObjectPath(row.image_url) ?? row.image_url, "categories.image_url");
    }
  }

  const { data: storeSettings, error: storeErr } = await supabase
    .from("store_settings")
    .select(
      "presale_hero_image_url, maintenance_hero_image_url, launch_hero_image_url"
    );
  if (storeErr) throw new Error(`store_settings query failed: ${storeErr.message}`);
  for (const row of storeSettings ?? []) {
    for (const [col, val] of Object.entries(row)) {
      if (typeof val === "string" && val.trim()) {
        addRef(parseProductImageObjectPath(val) ?? val, `store_settings.${col}`);
      }
    }
  }

  const { data: homeContent, error: homeErr } = await supabase
    .from("home_content")
    .select("sections");
  if (homeErr) throw new Error(`home_content query failed: ${homeErr.message}`);
  for (const row of homeContent ?? []) {
    const urls: string[] = [];
    extractUrlsFromJson(row.sections, urls);
    for (const url of urls) {
      addRef(parseProductImageObjectPath(url) ?? url, "home_content.sections");
    }
  }

  const { data: reviewMedia, error: reviewErr } = await supabase
    .from("review_media")
    .select("storage_path, public_url");
  if (reviewErr) throw new Error(`review_media query failed: ${reviewErr.message}`);
  for (const row of reviewMedia ?? []) {
    if (typeof row.storage_path === "string") {
      addRef(row.storage_path, "review_media.storage_path");
    }
    if (typeof row.public_url === "string") {
      addRef(parseProductImageObjectPath(row.public_url) ?? row.public_url, "review_media.public_url");
    }
  }

  const { data: blogPosts, error: blogErr } = await supabase
    .from("blog_posts")
    .select("cover_path");
  if (blogErr) throw new Error(`blog_posts query failed: ${blogErr.message}`);
  for (const row of blogPosts ?? []) {
    if (typeof row.cover_path === "string") {
      addRef(parseProductImageObjectPath(row.cover_path) ?? row.cover_path, "blog_posts.cover_path");
    }
  }

  const out = new Map<string, string[]>();
  for (const [path, set] of refs) {
    out.set(path, [...set].sort());
  }
  return out;
}

function sumBytes(items: Array<{ sizeBytes: number | null }>): number {
  return items.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Phase 8B — Storage orphan audit (read-only)");
  console.log(`Bucket: ${PRODUCT_IMAGES_BUCKET}`);
  console.log("Listing Storage objects…");

  const storageObjects = await listBucketRecursive(supabase);
  storageObjects.sort((a, b) => a.path.localeCompare(b.path));

  console.log(`Found ${storageObjects.length} Storage objects.`);

  const productImageStoragePaths = await fetchAllProductImagePaths(supabase);
  const referencedByProductImages = new Set<string>();
  const unparseableProductImageRefs: Array<{ raw: string; reason: string }> = [];

  for (const raw of productImageStoragePaths) {
    const parsed = parseProductImageObjectPath(raw, supabaseUrl);
    if (parsed) {
      referencedByProductImages.add(parsed);
    } else {
      const catalogParsed = parseCatalogObjectPath(raw, supabaseUrl);
      if (catalogParsed) {
        referencedByProductImages.add(catalogParsed);
      } else {
        unparseableProductImageRefs.push({
          raw,
          reason: "Could not parse product_images.storage_path to a product-images object path",
        });
      }
    }
  }

  const secondaryRefs = await fetchSecondaryReferenceStrings(supabase);
  const phase7ByOldPath = loadPhase7MigrationEntries(join(process.cwd(), "scripts", "logs"));

  const candidates: AuditCandidate[] = [];
  const ambiguous: AuditCandidate[] = [];

  for (const obj of storageObjects) {
    const referenced = referencedByProductImages.has(obj.path);
    const dbRefs = secondaryRefs.get(obj.path) ?? [];
    const phase7 = phase7ByOldPath.get(obj.path) ?? null;
    const catalog = isCatalogPath(obj.path);

    let category: OrphanCategory;
    let reason: string;

    if (referenced) {
      category = "referenced";
      reason = "Referenced by product_images.storage_path";
    } else if (phase7) {
      category = "phase7_old_original";
      reason = `Phase 7 migration old original (row ${phase7.rowId}); DB now points at ${phase7.newPath ?? "new WebP"}`;
    } else if (catalog) {
      category = "pre_existing_catalog_orphan";
      reason = "Catalog object not referenced by product_images and not recorded as a Phase 7 old original";
    } else {
      category = "non_catalog_unreferenced";
      reason = `Non-catalog path (${obj.path.split("/")[0]}/) not referenced by product_images`;
    }

    const candidate: AuditCandidate = {
      storagePath: obj.path,
      sizeBytes: obj.sizeBytes,
      mimeType: obj.mimeType,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
      category,
      referencedByProductImages: referenced,
      databaseReferences: dbRefs,
      reason,
      phase7MigrationLogMatch: phase7
        ? {
            matched: true,
            logFile: phase7.logFile,
            rowId: phase7.rowId,
            oldPath: phase7.oldPath,
            newPath: phase7.newPath,
            migratedAt: phase7.migratedAt,
          }
        : null,
    };

    const isAmbiguous =
      (referenced && phase7 != null) || (!referenced && dbRefs.length > 0);

    if (isAmbiguous) {
      ambiguous.push({
        ...candidate,
        category: "ambiguous",
        reason:
          referenced && phase7
            ? "Still referenced by product_images but also listed as a Phase 7 old original in migration logs"
            : `Not referenced by product_images but referenced elsewhere: ${dbRefs.join(", ")}`,
      });
    }

    candidates.push(candidate);
  }

  const referencedObjects = candidates.filter((c) => c.category === "referenced");
  const unreferencedCatalog = candidates.filter(
    (c) =>
      c.category === "phase7_old_original" || c.category === "pre_existing_catalog_orphan"
  );
  const phase7OldOriginals = candidates.filter((c) => c.category === "phase7_old_original");
  const preExistingCatalogOrphans = candidates.filter(
    (c) => c.category === "pre_existing_catalog_orphan"
  );
  const nonCatalogUnreferenced = candidates.filter((c) => c.category === "non_catalog_unreferenced");

  const phase7LogPaths = new Set(phase7ByOldPath.keys());
  const storagePathSet = new Set(storageObjects.map((o) => o.path));
  const phase7LogsMissingInStorage = [...phase7LogPaths].filter((p) => !storagePathSet.has(p));
  const phase7OldInStorageNotInLogs = phase7OldOriginals.filter(
    (c) => !phase7LogPaths.has(c.storagePath)
  );

  const at = new Date().toISOString();
  const stamp = at.replace(/[:.]/g, "-");
  const logsDir = join(process.cwd(), "scripts", "logs");
  mkdirSync(logsDir, { recursive: true });
  const outPath = join(logsDir, `storage-orphan-audit-${stamp}.json`);

  const report = {
    mode: "read-only-audit",
    phase: "8B",
    at,
    supabaseUrl,
    bucket: PRODUCT_IMAGES_BUCKET,
    safety: {
      storageDeletes: 0,
      databaseWrites: 0,
      metadataChanges: 0,
    },
    totals: {
      storageObjects: storageObjects.length,
      storageBytes: sumBytes(storageObjects),
      referencedObjects: referencedObjects.length,
      referencedBytes: sumBytes(referencedObjects),
      unreferencedCatalogObjects: unreferencedCatalog.length,
      unreferencedCatalogBytes: sumBytes(unreferencedCatalog),
      phase7OldOriginals: phase7OldOriginals.length,
      phase7OldOriginalBytes: sumBytes(phase7OldOriginals),
      preExistingCatalogOrphans: preExistingCatalogOrphans.length,
      preExistingCatalogOrphanBytes: sumBytes(preExistingCatalogOrphans),
      nonCatalogUnreferenced: nonCatalogUnreferenced.length,
      nonCatalogUnreferencedBytes: sumBytes(nonCatalogUnreferenced),
      ambiguous: ambiguous.length,
      productImagesRows: productImageStoragePaths.length,
      phase7MigrationLogOldPaths: phase7ByOldPath.size,
    },
    verification: {
      phase7LogOldPathsMissingInStorage: phase7LogsMissingInStorage,
      unparseableProductImageRefs,
      phase7OldInStorageNotInLogs: phase7OldInStorageNotInLogs.map((c) => c.storagePath),
    },
    referenced: referencedObjects,
    unreferencedCatalog: unreferencedCatalog,
    phase7OldOriginals,
    preExistingCatalogOrphans,
    nonCatalogUnreferenced,
    ambiguous,
    allCandidates: candidates,
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log("=== Phase 8B audit summary ===");
  console.log(`Total Storage objects: ${report.totals.storageObjects} (${formatBytes(report.totals.storageBytes)})`);
  console.log(
    `Referenced by product_images: ${report.totals.referencedObjects} (${formatBytes(report.totals.referencedBytes)})`
  );
  console.log(
    `Unreferenced catalog: ${report.totals.unreferencedCatalogObjects} (${formatBytes(report.totals.unreferencedCatalogBytes)})`
  );
  console.log(
    `  Phase 7 old originals: ${report.totals.phase7OldOriginals} (${formatBytes(report.totals.phase7OldOriginalBytes)})`
  );
  console.log(
    `  Pre-existing catalog orphans: ${report.totals.preExistingCatalogOrphans} (${formatBytes(report.totals.preExistingCatalogOrphanBytes)})`
  );
  console.log(
    `Non-catalog unreferenced: ${report.totals.nonCatalogUnreferenced} (${formatBytes(report.totals.nonCatalogUnreferencedBytes)})`
  );
  console.log(`Ambiguous / needs investigation: ${report.totals.ambiguous}`);
  console.log(`Storage deletes performed: ${report.safety.storageDeletes}`);
  console.log(`Audit log: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
