import type {
  OperationalCategory,
  OperationalSeverity,
} from "@/lib/errors/capture-event";
import {
  sanitizeOperationalMessage,
  sanitizeOperationalMetadata,
} from "@/lib/errors/sanitize";
import type {
  WebsiteHealthEventView,
  WebsiteHealthFilters,
  WebsiteHealthSummary,
} from "@/lib/website-health/types";

/** Metadata keys safe to show in Admin Website Health. */
const ALLOWED_META_KEYS = new Set([
  "code",
  "reason",
  "purpose",
  "outcome",
  "http_status",
  "operation",
  "provider",
  "provider_error_class",
  "latest_incident_id",
]);

const SEVERITY_RANK: Record<OperationalSeverity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
};

export function presentOperationalMetadata(
  meta: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const cleaned = sanitizeOperationalMetadata(meta);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cleaned)) {
    if (!ALLOWED_META_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export function presentWebsiteHealthEvent(row: {
  id: string;
  incident_id: string;
  fingerprint: string;
  severity: OperationalSeverity;
  category: OperationalCategory;
  surface: WebsiteHealthEventView["surface"];
  message: string;
  metadata: Record<string, unknown> | null;
  occurrence_count: number;
  status: WebsiteHealthEventView["status"];
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
}): WebsiteHealthEventView {
  return {
    id: row.id,
    incidentId: row.incident_id,
    fingerprint: row.fingerprint,
    severity: row.severity,
    category: row.category,
    surface: row.surface,
    message: sanitizeOperationalMessage(row.message),
    metadata: presentOperationalMetadata(row.metadata),
    occurrenceCount: Number(row.occurrence_count ?? 1),
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
  };
}

export function buildWebsiteHealthSummary(
  events: WebsiteHealthEventView[],
  nowMs = Date.now()
): WebsiteHealthSummary {
  const dayAgo = nowMs - 24 * 60 * 60 * 1000;
  const open = events.filter((e) => e.status === "open");
  const byCategoryMap = new Map<OperationalCategory, number>();
  for (const e of open) {
    byCategoryMap.set(e.category, (byCategoryMap.get(e.category) ?? 0) + 1);
  }

  return {
    openCount: open.length,
    criticalOpenCount: open.filter((e) => e.severity === "critical").length,
    errorOpenCount: open.filter((e) => e.severity === "error").length,
    warningOpenCount: open.filter((e) => e.severity === "warning").length,
    activeLast24hCount: events.filter((e) => Date.parse(e.lastSeenAt) >= dayAgo).length,
    totalOccurrencesOpen: open.reduce((sum, e) => sum + e.occurrenceCount, 0),
    byCategory: [...byCategoryMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
  };
}

export function filterWebsiteHealthEvents(
  events: WebsiteHealthEventView[],
  filters: WebsiteHealthFilters
): WebsiteHealthEventView[] {
  const q = filters.query.trim().toLowerCase();
  return events
    .filter((e) => (filters.status === "all" ? true : e.status === filters.status))
    .filter((e) => (filters.severity === "all" ? true : e.severity === filters.severity))
    .filter((e) => (filters.category === "all" ? true : e.category === filters.category))
    .filter((e) => {
      if (!q) return true;
      const hay = `${e.message} ${e.fingerprint} ${e.incidentId} ${e.category} ${e.surface}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => {
      const statusRank = (s: string) => (s === "open" ? 0 : s === "acknowledged" ? 1 : 2);
      const sr = statusRank(a.status) - statusRank(b.status);
      if (sr !== 0) return sr;
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
    });
}

/** Reject payloads that still look like secrets leaked into admin UI. */
export function websiteHealthPayloadLooksSafe(payload: unknown): boolean {
  const blob = JSON.stringify(payload ?? {}).toLowerCase();
  if (blob.includes("service_role")) return false;
  if (blob.includes("sk_live")) return false;
  if (blob.includes("whsec_")) return false;
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(blob)) return false;
  if (blob.includes("password")) return false;
  if (blob.includes("stack")) return false;
  return true;
}
