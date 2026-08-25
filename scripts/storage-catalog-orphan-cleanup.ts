/**
 * Phase 8C — approved catalog orphan cleanup (local operator only).
 *
 * Deletes ONLY Phase 7 old originals and pre-existing catalog orphans identified in Phase 8B.
 *
 * Dry-run (default):
 *   node ./node_modules/tsx/dist/cli.mjs scripts/storage-catalog-orphan-cleanup.ts --audit-log scripts/logs/storage-orphan-audit-<timestamp>.json
 *
 * Execute approved deletions:
 *   node ./node_modules/tsx/dist/cli.mjs scripts/storage-catalog-orphan-cleanup.ts --execute --audit-log scripts/logs/storage-orphan-audit-<timestamp>.json
 *
 * ZERO database writes. Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_IMAGES_BUCKET,
  isCatalogObjectPath,
  parseCatalogObjectPath,
  productImageRowReferencesCatalogPath,
} from "../lib/media/catalog-storage-path";

const BATCH_SIZE = 5;
const CONCURRENCY = 2;

type CleanupCategory = "phase7_old_original" | "pre_existing_catalog_orphan";

type AuditCandidate = {
  storagePath: string;
  sizeBytes: number | null;
  category: string;
};

type CleanupEntry = {
  path: string;
  sizeBytes: number | null;
  category: CleanupCategory | null;
  attempted: boolean;
  succeeded: boolean | null;
  skipped: boolean;
  skipReason: string | null;
  error: string | null;
  at: string;
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

function parseArgs(argv: string[]): { execute: boolean; auditLog: string | null } {
  let execute = false;
  let auditLog: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") execute = true;
    else if (arg === "--audit-log") auditLog = argv[++i] ?? null;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: storage-catalog-orphan-cleanup.ts [--execute] --audit-log <path>");
      process.exit(0);
    }
  }
  return { execute, auditLog };
}

function loadPhase7ProtectedNewPaths(logsDir: string): Set<string> {
  const protectedPaths = new Set<string>();
  if (!existsSync(logsDir)) return protectedPaths;

  for (const file of readdirSync(logsDir)) {
    if (!file.startsWith("catalog-image-migration-") || !file.endsWith(".json")) continue;
    if (file.includes("dry-run")) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(logsDir, file), "utf8")) as {
        results?: Array<{ status?: string; newPath?: string; oldPath?: string }>;
      };
      for (const row of parsed.results ?? []) {
        if (row.status === "migrated" && typeof row.newPath === "string") {
          protectedPaths.add(row.newPath);
        }
      }
    } catch {
      // ignore malformed logs
    }
  }
  return protectedPaths;
}

function loadPhase7OldPaths(logsDir: string): Set<string> {
  const oldPaths = new Set<string>();
  if (!existsSync(logsDir)) return oldPaths;

  for (const file of readdirSync(logsDir)) {
    if (!file.startsWith("catalog-image-migration-") || !file.endsWith(".json")) continue;
    if (file.includes("dry-run")) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(logsDir, file), "utf8")) as {
        results?: Array<{ status?: string; oldPath?: string }>;
      };
      for (const row of parsed.results ?? []) {
        if (row.status === "migrated" && typeof row.oldPath === "string") {
          oldPaths.add(row.oldPath);
        }
      }
    } catch {
      // ignore
    }
  }
  return oldPaths;
}

async function fetchReferencedCatalogPaths(
  supabase: SupabaseClient,
  supabaseUrl: string
): Promise<Set<string>> {
  const referenced = new Set<string>();
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
      if (typeof row.storage_path !== "string") continue;
      const parsed = parseCatalogObjectPath(row.storage_path.trim(), supabaseUrl);
      if (parsed) referenced.add(parsed);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return referenced;
}

async function fetchAllProductImageStoragePaths(supabase: SupabaseClient): Promise<string[]> {
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

function isReferencedByProductImages(
  catalogPath: string,
  productImagePaths: string[],
  supabaseUrl: string
): boolean {
  return productImagePaths.some((stored) =>
    productImageRowReferencesCatalogPath(stored, catalogPath, supabaseUrl)
  );
}

async function objectExists(supabase: SupabaseClient, path: string): Promise<boolean> {
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const name = path.slice(folder.length + (folder ? 1 : 0));
  const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).list(folder, {
    limit: 1000,
    search: name,
  });
  if (error) return false;
  return (data ?? []).some((item) => item.name === name && item.id != null);
}

async function listBucketRecursive(
  supabase: SupabaseClient,
  prefix = ""
): Promise<Array<{ path: string; sizeBytes: number | null }>> {
  const results: Array<{ path: string; sizeBytes: number | null }> = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Storage list failed: ${error.message}`);
    if (!data?.length) break;

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id == null) {
        results.push(...(await listBucketRecursive(supabase, itemPath)));
      } else {
        const meta = (item.metadata ?? {}) as Record<string, unknown>;
        const sizeRaw = meta.size ?? meta.contentLength;
        results.push({
          path: itemPath,
          sizeBytes: typeof sizeRaw === "number" ? sizeRaw : Number(sizeRaw) || null,
        });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return results;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      await worker(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { execute, auditLog } = parseArgs(process.argv.slice(2));

  if (!auditLog || !existsSync(auditLog)) {
    console.error("Missing or invalid --audit-log path (Phase 8B audit JSON required).");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const audit = JSON.parse(readFileSync(auditLog, "utf8")) as {
    phase7OldOriginals: AuditCandidate[];
    preExistingCatalogOrphans: AuditCandidate[];
    nonCatalogUnreferenced?: AuditCandidate[];
    ambiguous?: AuditCandidate[];
  };

  const logsDir = join(process.cwd(), "scripts", "logs");
  const phase7OldFromLogs = loadPhase7OldPaths(logsDir);
  const protectedNewPaths = loadPhase7ProtectedNewPaths(logsDir);

  const approvedCandidates: Array<{ path: string; sizeBytes: number | null; category: CleanupCategory }> =
    [];

  for (const item of audit.phase7OldOriginals ?? []) {
    approvedCandidates.push({
      path: item.storagePath,
      sizeBytes: item.sizeBytes,
      category: "phase7_old_original",
    });
  }
  for (const item of audit.preExistingCatalogOrphans ?? []) {
    approvedCandidates.push({
      path: item.storagePath,
      sizeBytes: item.sizeBytes,
      category: "pre_existing_catalog_orphan",
    });
  }

  console.log(`Phase 8C — catalog orphan cleanup (${execute ? "EXECUTE" : "DRY-RUN"})`);
  console.log(`Audit log: ${auditLog}`);
  console.log(`Approved candidates from audit: ${approvedCandidates.length}`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Fetching fresh product_images references…");
  const productImagePaths = await fetchAllProductImageStoragePaths(supabase);
  const referencedCatalogPaths = await fetchReferencedCatalogPaths(supabase, supabaseUrl);
  console.log(`product_images rows: ${productImagePaths.length}, referenced catalog paths: ${referencedCatalogPaths.size}`);

  const preExistingAllowlist = new Set(
    (audit.preExistingCatalogOrphans ?? []).map((c) => c.storagePath)
  );

  const toDelete: Array<{ path: string; sizeBytes: number | null; category: CleanupCategory }> = [];
  const skipped: CleanupEntry[] = [];

  for (const candidate of approvedCandidates) {
    const at = new Date().toISOString();
    const base: CleanupEntry = {
      path: candidate.path,
      sizeBytes: candidate.sizeBytes,
      category: candidate.category,
      attempted: false,
      succeeded: null,
      skipped: false,
      skipReason: null,
      error: null,
      at,
    };

    if (!candidate.path.startsWith("catalog/")) {
      skipped.push({ ...base, skipped: true, skipReason: "Not under catalog/ prefix" });
      continue;
    }

    if (!isCatalogObjectPath(candidate.path)) {
      skipped.push({ ...base, skipped: true, skipReason: "Failed catalog path validation" });
      continue;
    }

    if (isReferencedByProductImages(candidate.path, productImagePaths, supabaseUrl)) {
      skipped.push({
        ...base,
        skipped: true,
        skipReason: "Still referenced by product_images.storage_path (fresh check)",
      });
      continue;
    }

    if (referencedCatalogPaths.has(candidate.path)) {
      skipped.push({
        ...base,
        skipped: true,
        skipReason: "Present in fresh referenced catalog path set",
      });
      continue;
    }

    if (protectedNewPaths.has(candidate.path)) {
      skipped.push({
        ...base,
        skipped: true,
        skipReason: "Protected Phase 7 new WebP path — must not delete",
      });
      continue;
    }

    const isPhase7Old = phase7OldFromLogs.has(candidate.path);
    const isPreExisting = preExistingAllowlist.has(candidate.path);

    if (candidate.category === "phase7_old_original") {
      if (!isPhase7Old) {
        skipped.push({
          ...base,
          skipped: true,
          skipReason: "Marked phase7_old_original in audit but not found in migration logs",
        });
        continue;
      }
    } else if (candidate.category === "pre_existing_catalog_orphan") {
      if (!isPreExisting) {
        skipped.push({
          ...base,
          skipped: true,
          skipReason: "Not in pre-existing orphan allowlist from audit",
        });
        continue;
      }
      if (isPhase7Old) {
        skipped.push({
          ...base,
          skipped: true,
          skipReason: "Ambiguous: appears in both pre-existing and Phase 7 oldPath logs",
        });
        continue;
      }
    } else {
      skipped.push({ ...base, skipped: true, skipReason: "Unknown category" });
      continue;
    }

    toDelete.push(candidate);
  }

  console.log(`Passed safety checks: ${toDelete.length}`);
  console.log(`Skipped (uncertain/failed checks): ${skipped.length}`);

  const at = new Date().toISOString();
  const stamp = at.replace(/[:.]/g, "-");
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, `storage-catalog-orphan-cleanup-${stamp}.json`);
  const logJsonlPath = `${logPath}l`;

  const results: CleanupEntry[] = [...skipped];

  if (!execute) {
    for (const item of toDelete) {
      results.push({
        path: item.path,
        sizeBytes: item.sizeBytes,
        category: item.category,
        attempted: false,
        succeeded: null,
        skipped: false,
        skipReason: null,
        error: null,
        at,
      });
    }

    const summary = {
      mode: "dry-run",
      at,
      auditLog,
      approvedFromAudit: approvedCandidates.length,
      passedSafetyChecks: toDelete.length,
      skipped: skipped.length,
      wouldDeletePhase7: toDelete.filter((d) => d.category === "phase7_old_original").length,
      wouldDeletePreExisting: toDelete.filter((d) => d.category === "pre_existing_catalog_orphan")
        .length,
      databaseWrites: 0,
      entries: results,
    };
    writeFileSync(logPath, JSON.stringify(summary, null, 2), "utf8");
    console.log(`Dry-run complete. Log: ${logPath}`);
    console.log("Re-run with --execute to perform deletions.");
    return;
  }

  const deleteBatches: typeof toDelete[] = [];
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    deleteBatches.push(toDelete.slice(i, i + BATCH_SIZE));
  }

  let phase7Deleted = 0;
  let preExistingDeleted = 0;
  let failures = 0;
  let bytesFreed = 0;

  await runPool(deleteBatches, CONCURRENCY, async (batch) => {
    const freshProductPaths = await fetchAllProductImageStoragePaths(supabase);
    const batchSafe: typeof batch = [];

    for (const item of batch) {
      if (isReferencedByProductImages(item.path, freshProductPaths, supabaseUrl)) {
        const entry: CleanupEntry = {
          path: item.path,
          sizeBytes: item.sizeBytes,
          category: item.category,
          attempted: false,
          succeeded: null,
          skipped: true,
          skipReason: "Fresh pre-delete check: now referenced by product_images",
          error: null,
          at: new Date().toISOString(),
        };
        results.push(entry);
        appendFileSync(logJsonlPath, `${JSON.stringify(entry)}\n`, "utf8");
        continue;
      }
      if (protectedNewPaths.has(item.path)) {
        const entry: CleanupEntry = {
          path: item.path,
          sizeBytes: item.sizeBytes,
          category: item.category,
          attempted: false,
          succeeded: null,
          skipped: true,
          skipReason: "Fresh pre-delete check: protected new WebP path",
          error: null,
          at: new Date().toISOString(),
        };
        results.push(entry);
        appendFileSync(logJsonlPath, `${JSON.stringify(entry)}\n`, "utf8");
        continue;
      }
      batchSafe.push(item);
    }

    if (!batchSafe.length) return;

    const paths = batchSafe.map((b) => b.path);
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
    const batchAt = new Date().toISOString();

    if (error) {
      for (const item of batchSafe) {
        failures += 1;
        const entry: CleanupEntry = {
          path: item.path,
          sizeBytes: item.sizeBytes,
          category: item.category,
          attempted: true,
          succeeded: false,
          skipped: false,
          skipReason: null,
          error: error.message,
          at: batchAt,
        };
        results.push(entry);
        appendFileSync(logJsonlPath, `${JSON.stringify(entry)}\n`, "utf8");
      }
      return;
    }

    for (const item of batchSafe) {
      const stillThere = await objectExists(supabase, item.path);
      const succeeded = !stillThere;
      if (succeeded) {
        bytesFreed += item.sizeBytes ?? 0;
        if (item.category === "phase7_old_original") phase7Deleted += 1;
        else preExistingDeleted += 1;
      } else {
        failures += 1;
      }

      const entry: CleanupEntry = {
        path: item.path,
        sizeBytes: item.sizeBytes,
        category: item.category,
        attempted: true,
        succeeded,
        skipped: false,
        skipReason: null,
        error: succeeded ? null : "Object still present after delete attempt",
        at: batchAt,
      };
      results.push(entry);
      appendFileSync(logJsonlPath, `${JSON.stringify(entry)}\n`, "utf8");
    }
  });

  console.log("Post-cleanup verification…");
  const remainingObjects = await listBucketRecursive(supabase);
  const remainingBytes = remainingObjects.reduce((s, o) => s + (o.sizeBytes ?? 0), 0);

  const nonCatalogPrefixes = ["homepage/", "occasions/", "categories/", "store-control/"];
  const nonCatalogRemaining = remainingObjects.filter((o) =>
    nonCatalogPrefixes.some((p) => o.path.startsWith(p))
  );

  const freshRefs = await fetchReferencedCatalogPaths(supabase, supabaseUrl);
  const missingReferenced: string[] = [];
  for (const path of freshRefs) {
    const exists = remainingObjects.some((o) => o.path === path);
    if (!exists) missingReferenced.push(path);
  }

  const summary = {
    mode: "execute",
    at,
    completedAt: new Date().toISOString(),
    auditLog,
    approvedFromAudit: approvedCandidates.length,
    passedInitialSafetyChecks: toDelete.length,
    skippedBeforeDelete: skipped.length,
    deleted: {
      phase7OldOriginals: phase7Deleted,
      preExistingCatalogOrphans: preExistingDeleted,
      total: phase7Deleted + preExistingDeleted,
      bytesFreed,
    },
    failures,
    skippedDuringDelete: results.filter((r) => r.skipped && r.attempted === false).length - skipped.length,
    remaining: {
      objectCount: remainingObjects.length,
      totalBytes: remainingBytes,
      nonCatalogObjectCount: nonCatalogRemaining.length,
      nonCatalogPaths: nonCatalogRemaining.map((o) => o.path),
    },
    verification: {
      referencedCatalogPaths: freshRefs.size,
      missingReferencedProductImages: missingReferenced,
      allReferencedPresent: missingReferenced.length === 0,
      nonCatalogUntouched: nonCatalogRemaining.length === 11,
    },
    safety: {
      databaseWrites: 0,
      storageDeletesAttempted: results.filter((r) => r.attempted).length,
    },
    entries: results,
  };

  writeFileSync(logPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("");
  console.log("=== Phase 8C cleanup summary ===");
  console.log(`Phase 7 originals deleted: ${phase7Deleted}`);
  console.log(`Pre-existing orphans deleted: ${preExistingDeleted}`);
  console.log(`Failures: ${failures}`);
  console.log(`Total deleted: ${phase7Deleted + preExistingDeleted}`);
  console.log(`Bytes freed: ${formatBytes(bytesFreed)}`);
  console.log(`Remaining objects: ${remainingObjects.length} (${formatBytes(remainingBytes)})`);
  console.log(`Non-catalog remaining: ${nonCatalogRemaining.length}`);
  console.log(`All referenced product images present: ${missingReferenced.length === 0}`);
  console.log(`Database writes: 0`);
  console.log(`Log: ${logPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
