import { generateIncidentId } from "@/lib/errors/safe-response";
import {
  sanitizeOperationalMessage,
  sanitizeOperationalMetadata,
  stabilizeFingerprintToken,
} from "@/lib/errors/sanitize";

export type OperationalSeverity = "info" | "warning" | "error" | "critical";
export type OperationalCategory =
  | "checkout"
  | "payment"
  | "webhook"
  | "inventory"
  | "email"
  | "restock"
  | "auth"
  | "api";
export type OperationalSurface = "storefront" | "admin" | "superadmin" | "webhook" | "cron";
export type OperationalEventStatus = "open" | "acknowledged" | "resolved";

export type OperationalEventInput = {
  severity: OperationalSeverity;
  category: OperationalCategory;
  surface: OperationalSurface;
  /** Stable failure code used in the fingerprint (no volatile IDs). */
  code: string;
  message: string;
  incidentId?: string;
  fingerprint?: string;
  metadata?: Record<string, unknown>;
};

export type OperationalEventRecord = {
  id: string;
  incident_id: string;
  fingerprint: string;
  severity: OperationalSeverity;
  category: OperationalCategory;
  surface: OperationalSurface;
  message: string;
  metadata: Record<string, unknown>;
  occurrence_count: number;
  status: OperationalEventStatus;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CaptureOperationalEventResult =
  | { ok: true; created: boolean; event: OperationalEventRecord }
  | { ok: false; error: string };

export type OperationalEventStore = {
  findOpenByFingerprint: (fingerprint: string) => Promise<OperationalEventRecord | null>;
  insert: (
    row: Omit<
      OperationalEventRecord,
      "id" | "acknowledged_by" | "resolved_at"
    > & { id?: string }
  ) => Promise<OperationalEventRecord>;
  incrementOccurrence: (opts: {
    id: string;
    lastSeenAt: string;
    message: string;
    metadata: Record<string, unknown>;
    incidentId: string;
  }) => Promise<OperationalEventRecord>;
};

export function buildOperationalFingerprint(input: {
  category: OperationalCategory;
  surface: OperationalSurface;
  code: string;
}): string {
  const code = stabilizeFingerprintToken(input.code) || "unknown";
  return `${input.category}:${input.surface}:${code}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `oe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createMemoryOperationalEventStore(
  seed: OperationalEventRecord[] = []
): OperationalEventStore & { rows: OperationalEventRecord[] } {
  const rows = [...seed];
  return {
    rows,
    async findOpenByFingerprint(fingerprint) {
      return rows.find((r) => r.fingerprint === fingerprint && r.status === "open") ?? null;
    },
    async insert(row) {
      const now = row.created_at ?? nowIso();
      const record: OperationalEventRecord = {
        id: row.id ?? newId(),
        incident_id: row.incident_id,
        fingerprint: row.fingerprint,
        severity: row.severity,
        category: row.category,
        surface: row.surface,
        message: row.message,
        metadata: row.metadata,
        occurrence_count: row.occurrence_count,
        status: row.status,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        acknowledged_by: null,
        resolved_at: null,
        created_at: now,
        updated_at: row.updated_at ?? now,
      };
      rows.push(record);
      return record;
    },
    async incrementOccurrence({ id, lastSeenAt, message, metadata, incidentId }) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) throw new Error("event_not_found");
      const current = rows[idx]!;
      const updated: OperationalEventRecord = {
        ...current,
        occurrence_count: current.occurrence_count + 1,
        last_seen_at: lastSeenAt,
        updated_at: lastSeenAt,
        message,
        metadata,
        // Keep the original customer-facing incident id for correlation;
        // store the latest under metadata.latest_incident_id when different.
        incident_id: current.incident_id || incidentId,
      };
      rows[idx] = updated;
      return updated;
    },
  };
}

function mapRow(data: Record<string, unknown>): OperationalEventRecord {
  return {
    id: String(data.id),
    incident_id: String(data.incident_id),
    fingerprint: String(data.fingerprint),
    severity: data.severity as OperationalSeverity,
    category: data.category as OperationalCategory,
    surface: data.surface as OperationalSurface,
    message: String(data.message),
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    occurrence_count: Number(data.occurrence_count ?? 1),
    status: (data.status as OperationalEventStatus) ?? "open",
    first_seen_at: String(data.first_seen_at),
    last_seen_at: String(data.last_seen_at),
    acknowledged_by: data.acknowledged_by ? String(data.acknowledged_by) : null,
    resolved_at: data.resolved_at ? String(data.resolved_at) : null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

export function createSupabaseOperationalEventStore(): OperationalEventStore {
  return {
    async findOpenByFingerprint(fingerprint) {
      const { createServiceRoleClient } = await import("@/lib/supabase/server");
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("operational_events")
        .select("*")
        .eq("fingerprint", fingerprint)
        .eq("status", "open")
        .maybeSingle();
      if (error || !data) return null;
      return mapRow(data as Record<string, unknown>);
    },
    async insert(row) {
      const { createServiceRoleClient } = await import("@/lib/supabase/server");
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("operational_events")
        .insert({
          incident_id: row.incident_id,
          fingerprint: row.fingerprint,
          severity: row.severity,
          category: row.category,
          surface: row.surface,
          message: row.message,
          metadata: row.metadata,
          occurrence_count: row.occurrence_count,
          status: row.status,
          first_seen_at: row.first_seen_at,
          last_seen_at: row.last_seen_at,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "operational_events_insert_failed");
      }
      return mapRow(data as Record<string, unknown>);
    },
    async incrementOccurrence({ id, lastSeenAt, message, metadata, incidentId }) {
      const { createServiceRoleClient } = await import("@/lib/supabase/server");
      const supabase = createServiceRoleClient();
      const { data: current, error: readErr } = await supabase
        .from("operational_events")
        .select("occurrence_count, incident_id")
        .eq("id", id)
        .single();
      if (readErr || !current) {
        throw new Error(readErr?.message ?? "operational_events_read_failed");
      }
      const nextCount = Number(current.occurrence_count ?? 1) + 1;
      const mergedMeta =
        current.incident_id && current.incident_id !== incidentId
          ? { ...metadata, latest_incident_id: incidentId }
          : metadata;
      const { data, error } = await supabase
        .from("operational_events")
        .update({
          occurrence_count: nextCount,
          last_seen_at: lastSeenAt,
          updated_at: lastSeenAt,
          message,
          metadata: mergedMeta,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "operational_events_update_failed");
      }
      return mapRow(data as Record<string, unknown>);
    },
  };
}

let testOperationalEventStore: OperationalEventStore | null = null;

/** Test-only: route captures to an in-memory store instead of Supabase. */
export function setOperationalEventTestStore(store: OperationalEventStore | null): void {
  testOperationalEventStore = store;
}

/**
 * Record an operational failure for future Website Health dashboards.
 * NEVER throws to the caller — monitoring must not break business operations.
 */
export async function captureOperationalEvent(
  input: OperationalEventInput,
  store?: OperationalEventStore
): Promise<CaptureOperationalEventResult> {
  try {
    const fingerprint =
      input.fingerprint ??
      buildOperationalFingerprint({
        category: input.category,
        surface: input.surface,
        code: input.code,
      });
    const incidentId = input.incidentId?.trim() || generateIncidentId();
    const message = sanitizeOperationalMessage(input.message);
    const metadata = sanitizeOperationalMetadata({
      code: stabilizeFingerprintToken(input.code),
      ...(input.metadata ?? {}),
    });
    const seenAt = nowIso();
    const eventStore = store ?? testOperationalEventStore ?? createSupabaseOperationalEventStore();

    const existing = await eventStore.findOpenByFingerprint(fingerprint);
    if (existing) {
      const updated = await eventStore.incrementOccurrence({
        id: existing.id,
        lastSeenAt: seenAt,
        message,
        metadata:
          existing.incident_id !== incidentId
            ? { ...metadata, latest_incident_id: incidentId }
            : metadata,
        incidentId,
      });
      return { ok: true, created: false, event: updated };
    }

    const created = await eventStore.insert({
      incident_id: incidentId,
      fingerprint,
      severity: input.severity,
      category: input.category,
      surface: input.surface,
      message,
      metadata,
      occurrence_count: 1,
      status: "open",
      first_seen_at: seenAt,
      last_seen_at: seenAt,
      created_at: seenAt,
      updated_at: seenAt,
    });
    return { ok: true, created: true, event: created };
  } catch (err) {
    const error = err instanceof Error ? err.message : "capture_failed";
    console.error("[operational-event] capture failed:", error.slice(0, 240));
    return { ok: false, error };
  }
}

/** Fire-and-forget wrapper for route handlers. */
export function observeOperationalEvent(
  input: OperationalEventInput,
  store?: OperationalEventStore
): void {
  void captureOperationalEvent(input, store);
}
