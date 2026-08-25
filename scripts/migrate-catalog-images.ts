/**
 * Local operator script — Phase 7 catalog image migration.
 *
 * Dry-run (default):
 *   node ./node_modules/tsx/dist/cli.mjs scripts/migrate-catalog-images.ts --dry-run
 *
 * Limited pilot execute (must select a subset):
 *   node ./node_modules/tsx/dist/cli.mjs scripts/migrate-catalog-images.ts --execute --largest-png 5 --ids <uuid>
 *
 * Rollback from a migration log (restores product_images.storage_path; does not delete new objects):
 *   node ./node_modules/tsx/dist/cli.mjs scripts/migrate-catalog-images.ts --rollback <log.json>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local supported).
 * Never deletes Storage objects.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_IMAGES_BUCKET,
  catalogObjectPublicUrl,
  isCatalogObjectPath,
  parseCatalogObjectPath,
} from "../lib/media/catalog-storage-path";
import { VERSIONED_PUBLIC_IMAGE_CACHE_CONTROL } from "../lib/media/image-cache";
import { optimizeProductImageBuffer } from "../lib/media/optimize-product-image-node";
import { PRODUCT_IMAGE_MAX_LONG_EDGE } from "../lib/media/optimize-product-image";

type ProductImageRow = {
  id: string;
  product_id: string;
  storage_path: string;
};

type DryRunRowReport = {
  rowId: string;
  productId: string;
  currentUrl: string;
  currentPath: string | null;
  currentSizeBytes: number | null;
  mimeType: string | null;
  eligible: boolean;
  ineligibleReason: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  wouldResize: boolean | null;
  estimatedOptimizedBytes: number | null;
  estimatedReductionPercent: number | null;
  estimateError: string | null;
};

type MigrateResult = {
  rowId: string;
  productId: string;
  status: "migrated" | "failed" | "skipped";
  error: string | null;
  oldUrl: string;
  oldPath: string | null;
  newUrl: string | null;
  newPath: string | null;
  oldSizeBytes: number | null;
  newSizeBytes: number | null;
  oldMime: string | null;
  newMime: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  resized: boolean | null;
  reductionPercent: number | null;
  originalStillPresent: boolean | null;
  dbUpdated: boolean;
  at: string;
};

type CliOptions = {
  dryRun: boolean;
  execute: boolean;
  rollbackPath: string | null;
  concurrency: number;
  limit: number | null;
  pilot: number | null;
  largestPng: number | null;
  largest: number | null;
  remaining: boolean;
  ids: Set<string> | null;
  excludeIds: Set<string> | null;
  jsonOut: string | null;
  skipEstimate: boolean;
};

/** Hard safety: refuse execute batches larger than this. Raise only for approved controlled batches. */
const EXECUTE_HARD_MAX = 50;

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

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    execute: false,
    rollbackPath: null,
    concurrency: 2,
    limit: null,
    pilot: null,
    largestPng: null,
    largest: null,
    remaining: false,
    ids: null,
    excludeIds: null,
    jsonOut: null,
    skipEstimate: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--execute") opts.execute = true;
    else if (arg === "--skip-estimate") opts.skipEstimate = true;
    else if (arg === "--rollback") {
      opts.rollbackPath = argv[++i] ?? null;
    } else if (arg === "--concurrency") {
      opts.concurrency = Math.max(1, Number(argv[++i] ?? 2));
    } else if (arg === "--limit") {
      opts.limit = Math.max(1, Number(argv[++i]));
    } else if (arg === "--pilot") {
      opts.pilot = Math.max(1, Number(argv[++i]));
    } else if (arg === "--largest-png") {
      opts.largestPng = Math.max(1, Number(argv[++i]));
    }     else if (arg === "--largest") {
      opts.largest = Math.max(1, Number(argv[++i]));
    } else if (arg === "--remaining") {
      opts.remaining = true;
    } else if (arg === "--ids") {
      opts.ids = new Set(
        (argv[++i] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    } else if (arg === "--exclude-ids") {
      opts.excludeIds = new Set(
        (argv[++i] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    } else if (arg === "--json-out") {
      opts.jsonOut = argv[++i] ?? null;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!opts.dryRun && !opts.execute && !opts.rollbackPath) {
    opts.dryRun = true;
  }

  return opts;
}

function printHelp(): void {
  console.log(`Phase 7 catalog image migration (local operator only)

Flags:
  --dry-run                 Report only; no Storage or DB writes (default)
  --execute                 Migrate a limited subset (requires --ids / --largest / --largest-png / --pilot / --limit)
  --largest <n>             Select the n largest eligible catalog images (any allowed MIME)
  --remaining               Select all remaining unmigrated JPEG/PNG catalog images
  --largest-png <n>         Select the n largest eligible PNG catalog images
  --ids <id1,id2>           Include specific product_images row UUIDs
  --exclude-ids <id1,id2>   Skip already-migrated (or otherwise excluded) row UUIDs
  --pilot <n> / --limit <n> Cap selected rows
  --concurrency <n>         Parallel workers (default 2)
  --rollback <log.json>     Restore storage_path from a migration log
  --json-out <path>         Write report JSON
  --skip-estimate           Dry-run metadata only

Safety: --execute refuses full-catalog runs (hard max ${EXECUTE_HARD_MAX}). Never deletes Storage objects.
`);
}

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function pctReduction(before: number | null, after: number | null): number | null {
  if (before == null || after == null || before <= 0) return null;
  return Math.round(((before - after) / before) * 1000) / 10;
}

function newCatalogObjectPath(fileName: string): string {
  return `catalog/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fileName}`;
}

function ensureLogsDir(): string {
  const dir = join(process.cwd(), "scripts", "logs");
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function fetchProductImageRows(supabase: SupabaseClient): Promise<ProductImageRow[]> {
  const pageSize = 1000;
  const rows: ProductImageRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("product_images")
      .select("id, product_id, storage_path")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to load product_images: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as ProductImageRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function headPublicObject(
  url: string
): Promise<{ size: number | null; mime: string | null; ok: boolean }> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (!res.ok) return { size: null, mime: null, ok: false };
    const len = res.headers.get("content-length");
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? null;
    return {
      size: len ? Number(len) : null,
      mime,
      ok: true,
    };
  } catch {
    return { size: null, mime: null, ok: false };
  }
}

async function downloadPublicObject(url: string, attempts = 3): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        if (attempt === attempts) return null;
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      if (attempt === attempts) return null;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return null;
}

function isLowPriorityAlreadyOptimizedWebp(
  mime: string | null,
  size: number | null,
  sourceWidth: number | null,
  sourceHeight: number | null
): boolean {
  if (mime !== "image/webp") return false;
  if (size != null && size < 200 * 1024) return true;
  const longEdge = Math.max(sourceWidth ?? 0, sourceHeight ?? 0);
  return longEdge > 0 && longEdge <= PRODUCT_IMAGE_MAX_LONG_EDGE;
}

async function analyzeRow(
  row: ProductImageRow,
  supabaseUrl: string,
  skipEstimate: boolean
): Promise<DryRunRowReport> {
  const base: DryRunRowReport = {
    rowId: row.id,
    productId: row.product_id,
    currentUrl: row.storage_path.trim(),
    currentPath: null,
    currentSizeBytes: null,
    mimeType: null,
    eligible: false,
    ineligibleReason: null,
    sourceWidth: null,
    sourceHeight: null,
    outputWidth: null,
    outputHeight: null,
    wouldResize: null,
    estimatedOptimizedBytes: null,
    estimatedReductionPercent: null,
    estimateError: null,
  };

  const catalogPath = parseCatalogObjectPath(base.currentUrl, supabaseUrl);
  base.currentPath = catalogPath;

  if (!catalogPath) {
    base.ineligibleReason = "Not a product-images catalog URL/path";
    return base;
  }

  const publicUrl = catalogObjectPublicUrl(catalogPath, supabaseUrl) ?? base.currentUrl;
  const head = await headPublicObject(publicUrl);
  if (!head.ok) {
    base.ineligibleReason = "Storage object not reachable at public URL";
    return base;
  }

  base.currentSizeBytes = head.size;
  base.mimeType = head.mime;

  if (head.mime && !["image/jpeg", "image/png", "image/webp"].includes(head.mime)) {
    base.ineligibleReason = `Unsupported MIME type: ${head.mime}`;
    return base;
  }

  if (skipEstimate) {
    base.eligible = true;
    return base;
  }

  const bytes = await downloadPublicObject(publicUrl);
  if (!bytes) {
    base.ineligibleReason = "Could not download object for optimization estimate";
    return base;
  }

  if (head.size == null) {
    base.currentSizeBytes = bytes.length;
  }

  const fileName = catalogPath.split("/").pop() ?? "image.jpg";
  const optimized = await optimizeProductImageBuffer(bytes, {
    sourceMime: head.mime,
    originalFileName: fileName,
  });

  if (!optimized.ok) {
    base.ineligibleReason = optimized.error;
    base.estimateError = optimized.error;
    return base;
  }

  base.sourceWidth = optimized.sourceWidth;
  base.sourceHeight = optimized.sourceHeight;
  base.outputWidth = optimized.outputWidth;
  base.outputHeight = optimized.outputHeight;
  base.wouldResize = optimized.resized;
  base.estimatedOptimizedBytes = optimized.buffer.length;
  base.estimatedReductionPercent = pctReduction(base.currentSizeBytes, optimized.buffer.length);

  if (
    isLowPriorityAlreadyOptimizedWebp(
      head.mime,
      base.currentSizeBytes,
      optimized.sourceWidth,
      optimized.sourceHeight
    )
  ) {
    base.eligible = false;
    base.ineligibleReason = "Already small WebP at or below max long edge (optional skip)";
    return base;
  }

  base.eligible = true;
  return base;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker());
  await Promise.all(workers);
  return results;
}

const ALLOWED_HEAD_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

async function selectRemainingJpegPngRows(
  rows: ProductImageRow[],
  supabaseUrl: string,
  concurrency: number,
  excludeIds?: Set<string> | null
): Promise<ProductImageRow[]> {
  return selectLargestRows(rows, Number.MAX_SAFE_INTEGER, supabaseUrl, concurrency, {
    excludeIds,
    jpegPngOnly: true,
  });
}

async function selectLargestRows(
  rows: ProductImageRow[],
  count: number,
  supabaseUrl: string,
  concurrency: number,
  options?: { pngOnly?: boolean; jpegPngOnly?: boolean; excludeIds?: Set<string> | null }
): Promise<ProductImageRow[]> {
  const excludeIds = options?.excludeIds ?? null;
  const pngOnly = options?.pngOnly ?? false;
  const jpegPngOnly = options?.jpegPngOnly ?? false;

  const candidates = rows.filter((r) => {
    if (excludeIds?.has(r.id)) return false;
    const path = parseCatalogObjectPath(r.storage_path.trim(), supabaseUrl);
    if (!path) return false;
    // Skip rows already pointing at WebP (includes Phase 7 outputs and the optional pre-optimized skip).
    if (/\.webp$/i.test(path)) return false;
    if (pngOnly && !/\.png$/i.test(path)) return false;
    if (jpegPngOnly && !/\.(jpe?g|png)$/i.test(path)) return false;
    return true;
  });

  const sized = await mapWithConcurrency(candidates, concurrency, async (row) => {
    const path = parseCatalogObjectPath(row.storage_path.trim(), supabaseUrl)!;
    const url = catalogObjectPublicUrl(path, supabaseUrl) ?? row.storage_path.trim();
    const head = await headPublicObject(url);
    const mimeOk =
      head.mime == null ||
      ALLOWED_HEAD_MIME.has(head.mime) ||
      (pngOnly && head.mime === "image/png");
    return {
      row,
      size: head.ok ? (head.size ?? 0) : 0,
      ok: head.ok && mimeOk && (!pngOnly || head.mime == null || head.mime === "image/png"),
    };
  });

  return sized
    .filter((s) => s.ok && s.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, count)
    .map((s) => s.row);
}

function selectRows(
  rows: ProductImageRow[],
  opts: CliOptions,
  largestSelectedRows: ProductImageRow[]
): ProductImageRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const selected = new Map<string, ProductImageRow>();

  for (const row of largestSelectedRows) {
    if (opts.excludeIds?.has(row.id)) continue;
    selected.set(row.id, row);
  }

  if (opts.ids?.size) {
    for (const id of opts.ids) {
      if (opts.excludeIds?.has(id)) continue;
      const row = byId.get(id);
      if (row) selected.set(row.id, row);
    }
  }

  let list = [...selected.values()];

  // If only --pilot/--limit without --largest*/--ids, take first N by id (legacy dry-run).
  if (!largestSelectedRows.length && !opts.ids?.size) {
    list = rows.filter((r) => !opts.excludeIds?.has(r.id));
    const cap = opts.pilot ?? opts.limit;
    if (cap != null) list = list.slice(0, cap);
  }

  return list;
}

function printDryRunSummary(reports: DryRunRowReport[]): void {
  const eligible = reports.filter((r) => r.eligible);
  const ineligible = reports.filter((r) => !r.eligible);
  const totalCurrent = reports.reduce((s, r) => s + (r.currentSizeBytes ?? 0), 0);
  const totalEstimated = eligible.reduce((s, r) => s + (r.estimatedOptimizedBytes ?? 0), 0);
  const eligibleCurrent = eligible.reduce((s, r) => s + (r.currentSizeBytes ?? 0), 0);

  console.log("\n=== Phase 7 dry-run summary ===");
  console.log(`Rows analyzed: ${reports.length}`);
  console.log(`Eligible: ${eligible.length}`);
  console.log(`Ineligible / skipped: ${ineligible.length}`);
  console.log(`Current size (analyzed): ${formatBytes(totalCurrent)}`);
  console.log(`Current size (eligible only): ${formatBytes(eligibleCurrent)}`);
  console.log(`Estimated optimized (eligible): ${formatBytes(totalEstimated)}`);
  if (eligibleCurrent > 0 && totalEstimated > 0) {
    console.log(`Estimated reduction (eligible): ${pctReduction(eligibleCurrent, totalEstimated)}%`);
  }
}

async function migrateOneRow(
  row: ProductImageRow,
  supabase: SupabaseClient,
  supabaseUrl: string
): Promise<MigrateResult> {
  const at = new Date().toISOString();
  const oldUrl = row.storage_path.trim();
  const base: MigrateResult = {
    rowId: row.id,
    productId: row.product_id,
    status: "failed",
    error: null,
    oldUrl,
    oldPath: null,
    newUrl: null,
    newPath: null,
    oldSizeBytes: null,
    newSizeBytes: null,
    oldMime: null,
    newMime: null,
    sourceWidth: null,
    sourceHeight: null,
    outputWidth: null,
    outputHeight: null,
    resized: null,
    reductionPercent: null,
    originalStillPresent: null,
    dbUpdated: false,
    at,
  };

  const oldPath = parseCatalogObjectPath(oldUrl, supabaseUrl);
  base.oldPath = oldPath;
  if (!oldPath) {
    base.error = "Not a product-images catalog URL/path";
    base.status = "skipped";
    return base;
  }

  const oldPublicUrl = catalogObjectPublicUrl(oldPath, supabaseUrl) ?? oldUrl;
  const head = await headPublicObject(oldPublicUrl);
  base.oldSizeBytes = head.size;
  base.oldMime = head.mime;

  const bytes = await downloadPublicObject(oldPublicUrl);
  if (!bytes) {
    base.error = "Could not download original object";
    return base;
  }
  if (base.oldSizeBytes == null) base.oldSizeBytes = bytes.length;

  const originalFileName = oldPath.split("/").pop() ?? "image.jpg";
  const optimized = await optimizeProductImageBuffer(bytes, {
    sourceMime: head.mime,
    originalFileName,
  });
  if (!optimized.ok) {
    base.error = optimized.error;
    return base;
  }

  base.sourceWidth = optimized.sourceWidth;
  base.sourceHeight = optimized.sourceHeight;
  base.outputWidth = optimized.outputWidth;
  base.outputHeight = optimized.outputHeight;
  base.resized = optimized.resized;
  base.newMime = optimized.mime;
  base.newSizeBytes = optimized.buffer.length;
  base.reductionPercent = pctReduction(base.oldSizeBytes, optimized.buffer.length);

  // Phase 7 safeguard: never replace an original unless the optimized file is strictly smaller.
  if (base.oldSizeBytes != null && optimized.buffer.length >= base.oldSizeBytes) {
    const originalStill = await headPublicObject(oldPublicUrl);
    base.originalStillPresent = originalStill.ok;
    base.status = "skipped";
    base.error = `Optimized output not smaller than original (${optimized.buffer.length} >= ${base.oldSizeBytes} bytes)`;
    return base;
  }

  const newPath = newCatalogObjectPath(optimized.fileName);
  if (!isCatalogObjectPath(newPath)) {
    base.error = "Generated path failed catalog validation";
    return base;
  }
  base.newPath = newPath;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(newPath, optimized.buffer, {
      cacheControl: VERSIONED_PUBLIC_IMAGE_CACHE_CONTROL,
      upsert: false,
      contentType: optimized.mime,
    });

  if (uploadError) {
    base.error = `Upload failed: ${uploadError.message}`;
    return base;
  }

  const { data: pub } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(newPath);
  const newUrl = pub?.publicUrl ?? catalogObjectPublicUrl(newPath, supabaseUrl);
  if (!newUrl) {
    base.error = "Could not resolve public URL for new object";
    return base;
  }
  base.newUrl = newUrl;

  // Verify new object is readable before switching DB.
  const verifyHead = await headPublicObject(newUrl);
  const verifyBytes = await downloadPublicObject(newUrl, 2);
  if (!verifyHead.ok || !verifyBytes || verifyBytes.length === 0) {
    base.error = "Verification failed: new object not readable";
    return base;
  }
  if (verifyBytes.length !== optimized.buffer.length) {
    // Prefer actual stored size if Content-Length differs slightly; still require non-empty match of readable bytes.
    base.newSizeBytes = verifyBytes.length;
  }

  // Confirm original still present (we never delete).
  const originalStill = await headPublicObject(oldPublicUrl);
  base.originalStillPresent = originalStill.ok;

  const { data: updated, error: updateError } = await supabase
    .from("product_images")
    .update({ storage_path: newUrl })
    .eq("id", row.id)
    .eq("storage_path", oldUrl)
    .select("id")
    .maybeSingle();

  if (updateError) {
    base.error = `DB update failed (new object left in Storage; original unchanged): ${updateError.message}`;
    return base;
  }
  if (!updated) {
    base.error =
      "DB update matched zero rows (row changed concurrently?). New object left in Storage; original URL unchanged.";
    return base;
  }

  base.dbUpdated = true;
  base.status = "migrated";
  return base;
}

async function runRollback(logPath: string, supabase: SupabaseClient, supabaseUrl: string): Promise<void> {
  if (!existsSync(logPath)) {
    throw new Error(`Rollback log not found: ${logPath}`);
  }
  const raw = JSON.parse(readFileSync(logPath, "utf8")) as {
    results?: MigrateResult[];
    rows?: MigrateResult[];
  };
  const results = raw.results ?? raw.rows ?? [];
  const migrated = results.filter((r) => r.status === "migrated" && r.dbUpdated && r.oldUrl);

  console.log(`Rollback: restoring ${migrated.length} product_images.storage_path values`);
  for (const entry of migrated) {
    if (entry.oldPath) {
      const oldPublic = catalogObjectPublicUrl(entry.oldPath, supabaseUrl) ?? entry.oldUrl;
      const head = await headPublicObject(oldPublic);
      if (!head.ok) {
        console.error(`SKIP ${entry.rowId}: original not reachable at ${entry.oldPath}`);
        continue;
      }
    }

    const { error } = await supabase
      .from("product_images")
      .update({ storage_path: entry.oldUrl })
      .eq("id", entry.rowId);

    if (error) {
      console.error(`FAIL ${entry.rowId}: ${error.message}`);
    } else {
      console.log(`RESTORED ${entry.rowId} → ${entry.oldPath}`);
    }
  }
  console.log("Rollback complete. New optimized objects were not deleted (become orphans).");
}

async function runDryRun(
  opts: CliOptions,
  supabase: SupabaseClient,
  supabaseUrl: string,
  selected: ProductImageRow[],
  allRows: ProductImageRow[],
  catalogRows: ProductImageRow[]
): Promise<void> {
  console.log("Phase 7 catalog image migration — DRY RUN");
  console.log(`Bucket: ${PRODUCT_IMAGES_BUCKET}/catalog/`);
  console.log(`Concurrency: ${opts.concurrency}`);
  console.log("Storage writes: none | DB writes: none\n");
  console.log(`product_images total: ${allRows.length}`);
  console.log(`catalog-referenced: ${catalogRows.length}`);
  console.log(`analyzing: ${selected.length}\n`);

  const reports = await mapWithConcurrency(selected, opts.concurrency, (row) =>
    analyzeRow(row, supabaseUrl, opts.skipEstimate)
  );

  printDryRunSummary(reports);
  console.log("\n=== Per-row dry-run report ===");
  for (const r of reports) {
    console.log(
      [
        r.rowId,
        `product=${r.productId}`,
        r.eligible ? "ELIGIBLE" : "SKIP",
        r.currentPath ?? "—",
        formatBytes(r.currentSizeBytes),
        r.mimeType ?? "—",
        r.estimatedOptimizedBytes != null ? formatBytes(r.estimatedOptimizedBytes) : "—",
        r.estimatedReductionPercent != null ? `${r.estimatedReductionPercent}%` : "—",
        r.ineligibleReason ?? "",
      ].join(" | ")
    );
  }

  const jsonPath =
    opts.jsonOut ??
    join(
      ensureLogsDir(),
      `catalog-image-migration-dry-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        mode: "dry-run",
        at: new Date().toISOString(),
        supabaseUrl,
        totals: {
          productImagesTotal: allRows.length,
          catalogReferenced: catalogRows.length,
          analyzed: reports.length,
          eligible: reports.filter((r) => r.eligible).length,
        },
        rows: reports,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\nJSON report: ${jsonPath}`);
}

async function runExecute(
  opts: CliOptions,
  supabase: SupabaseClient,
  supabaseUrl: string,
  selected: ProductImageRow[],
  allRows: ProductImageRow[]
): Promise<void> {
  if (selected.length === 0) {
    throw new Error("No rows selected for execute.");
  }
  if (selected.length > EXECUTE_HARD_MAX) {
    throw new Error(
      `Refusing to execute ${selected.length} rows (hard max ${EXECUTE_HARD_MAX}). Use a smaller pilot.`
    );
  }
  if (selected.length >= allRows.length) {
    throw new Error("Refusing full-catalog execute. Select a pilot subset.");
  }

  console.log("Phase 7 catalog image migration — EXECUTE (controlled batch)");
  console.log(`Bucket: ${PRODUCT_IMAGES_BUCKET}/catalog/`);
  console.log(`Rows to migrate: ${selected.length}`);
  console.log("Originals: preserved (never deleted)");
  console.log("DB updates: only selected product_images rows after verification\n");

  for (const row of selected) {
    console.log(`- ${row.id} | ${parseCatalogObjectPath(row.storage_path.trim(), supabaseUrl)}`);
  }
  console.log("");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath =
    opts.jsonOut ?? join(ensureLogsDir(), `catalog-image-migration-batch-${stamp}.json`);
  const jsonlPath = join(ensureLogsDir(), `catalog-image-migration-batch-${stamp}.jsonl`);

  const results: MigrateResult[] = [];

  const migratedResults = await mapWithConcurrency(
    selected,
    Math.min(Math.max(opts.concurrency, 1), 3),
    async (row) => {
      console.log(`Migrating ${row.id}…`);
      const result = await migrateOneRow(row, supabase, supabaseUrl);
      appendFileSync(jsonlPath, `${JSON.stringify(result)}\n`, "utf8");
      if (result.status === "migrated") {
        console.log(
          `  OK ${formatBytes(result.oldSizeBytes)} → ${formatBytes(result.newSizeBytes)} (${result.reductionPercent}%) ${result.newPath}`
        );
      } else {
        console.log(`  ${result.status.toUpperCase()}: ${result.error}`);
      }
      return result;
    }
  );
  results.push(...migratedResults);

  const migrated = results.filter((r) => r.status === "migrated");
  const failed = results.filter((r) => r.status === "failed");
  const skipped = results.filter((r) => r.status === "skipped");
  const skippedNoNetSavings = skipped.filter((r) =>
    (r.error ?? "").includes("Optimized output not smaller than original")
  );

  const migratedOldBytes = migrated.reduce((s, r) => s + (r.oldSizeBytes ?? 0), 0);
  const migratedNewBytes = migrated.reduce((s, r) => s + (r.newSizeBytes ?? 0), 0);

  // Confirm only pilot rows changed: re-read those IDs and spot-check a non-pilot row still has old URL if we tracked any.
  const pilotIds = new Set(selected.map((r) => r.id));
  const { data: afterRows, error: afterErr } = await supabase
    .from("product_images")
    .select("id, storage_path")
    .in("id", [...pilotIds]);

  if (afterErr) {
    console.error(`Post-check read failed: ${afterErr.message}`);
  }

  const originalsPresent = await mapWithConcurrency(
    results.filter((m) => m.oldPath),
    3,
    async (m) => {
      const url = catalogObjectPublicUrl(m.oldPath!, supabaseUrl) ?? m.oldUrl;
      const head = await headPublicObject(url);
      return { rowId: m.rowId, ok: head.ok };
    }
  );

  writeFileSync(
    logPath,
    JSON.stringify(
      {
        mode: "execute-batch",
        at: new Date().toISOString(),
        supabaseUrl,
        selectedIds: selected.map((r) => r.id),
        totals: {
          attempted: results.length,
          migrated: migrated.length,
          failed: failed.length,
          skipped: skipped.length,
          skippedNoNetSavings: skippedNoNetSavings.length,
          migratedOldBytes,
          migratedNewBytes,
          migratedBytesSaved: migratedOldBytes - migratedNewBytes,
        },
        originalsStillPresent: originalsPresent.every((o) => o.ok),
        originalsCheck: originalsPresent,
        afterBatchRows: afterRows ?? null,
        results,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\n=== Batch execute summary ===");
  console.log(`Attempted: ${results.length}`);
  console.log(`Migrated: ${migrated.length}`);
  console.log(`Skipped (no net savings): ${skippedNoNetSavings.length}`);
  console.log(`Skipped (other): ${skipped.length - skippedNoNetSavings.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Migrated bytes: ${formatBytes(migratedOldBytes)} → ${formatBytes(migratedNewBytes)}`);
  if (migratedOldBytes > 0) {
    console.log(`Migrated savings: ${formatBytes(migratedOldBytes - migratedNewBytes)} (${pctReduction(migratedOldBytes, migratedNewBytes)}%)`);
  }
  console.log(
    `Originals still present: ${originalsPresent.every((o) => o.ok) ? "YES" : "NO — investigate"}`
  );
  console.log(`Migration log: ${logPath}`);
  console.log(`JSONL log: ${jsonlPath}`);
  console.log("\n=== Per-row results ===");
  for (const r of results) {
    console.log(
      [
        r.status.toUpperCase(),
        r.rowId,
        r.oldPath ?? "—",
        "→",
        r.newPath ?? "—",
        formatBytes(r.oldSizeBytes),
        "→",
        formatBytes(r.newSizeBytes),
        r.sourceWidth != null ? `${r.sourceWidth}x${r.sourceHeight}` : "—",
        "→",
        r.outputWidth != null ? `${r.outputWidth}x${r.outputHeight}` : "—",
        r.newMime ?? "—",
        r.reductionPercent != null ? `${r.reductionPercent}%` : "—",
        r.error ?? "",
      ].join(" | ")
    );
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const opts = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (opts.rollbackPath) {
    await runRollback(opts.rollbackPath, supabase, supabaseUrl);
    return;
  }

  if (opts.execute && opts.dryRun) {
    console.error("Pass either --dry-run or --execute, not both.");
    process.exit(1);
  }

  if (opts.execute) {
    const hasSubset =
      Boolean(opts.ids?.size) ||
      opts.remaining ||
      opts.largest != null ||
      opts.largestPng != null ||
      opts.pilot != null ||
      opts.limit != null;
    if (!hasSubset) {
      console.error(
        "--execute requires a subset: --remaining and/or --largest N and/or --largest-png N and/or --ids … and/or --pilot/--limit N"
      );
      process.exit(1);
    }
  }

  const allRows = await fetchProductImageRows(supabase);
  const catalogRows = allRows.filter((r) =>
    Boolean(parseCatalogObjectPath(r.storage_path.trim(), supabaseUrl))
  );

  let largestSelectedRows: ProductImageRow[] = [];
  if (opts.remaining) {
    console.log("Selecting all remaining unmigrated JPEG/PNG catalog images…");
    largestSelectedRows = await selectRemainingJpegPngRows(
      catalogRows,
      supabaseUrl,
      opts.concurrency,
      opts.excludeIds
    );
    console.log(`Selected remaining JPEG/PNG: ${largestSelectedRows.length}`);
  } else if (opts.largest != null) {
    console.log(`Selecting ${opts.largest} largest eligible unmigrated catalog images…`);
    largestSelectedRows = await selectLargestRows(
      catalogRows,
      opts.largest,
      supabaseUrl,
      opts.concurrency,
      { excludeIds: opts.excludeIds }
    );
    console.log(`Selected largest: ${largestSelectedRows.length}`);
  } else if (opts.largestPng != null) {
    console.log(`Selecting ${opts.largestPng} largest PNG catalog images…`);
    largestSelectedRows = await selectLargestRows(
      catalogRows,
      opts.largestPng,
      supabaseUrl,
      opts.concurrency,
      { pngOnly: true, excludeIds: opts.excludeIds }
    );
    console.log(`Selected largest PNGs: ${largestSelectedRows.length}`);
  }

  const selected = selectRows(catalogRows, opts, largestSelectedRows);

  if (opts.execute) {
    await runExecute(opts, supabase, supabaseUrl, selected, allRows);
    return;
  }

  await runDryRun(opts, supabase, supabaseUrl, selected, allRows, catalogRows);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
