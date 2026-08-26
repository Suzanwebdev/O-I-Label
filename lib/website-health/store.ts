import { createServiceRoleClient } from "@/lib/supabase/server";
import type { OperationalSeverity, OperationalCategory, OperationalSurface, OperationalEventStatus } from "@/lib/errors/capture-event";
import { presentWebsiteHealthEvent, buildWebsiteHealthSummary } from "@/lib/website-health/present";
import type { WebsiteHealthEventView, WebsiteHealthSummary } from "@/lib/website-health/types";

const SELECT_COLUMNS =
  "id, incident_id, fingerprint, severity, category, surface, message, metadata, occurrence_count, status, first_seen_at, last_seen_at, resolved_at";

type RawRow = {
  id: string;
  incident_id: string;
  fingerprint: string;
  severity: OperationalSeverity;
  category: OperationalCategory;
  surface: OperationalSurface;
  message: string;
  metadata: Record<string, unknown> | null;
  occurrence_count: number;
  status: OperationalEventStatus;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

export type WebsiteHealthSnapshot =
  | { ok: true; events: WebsiteHealthEventView[]; summary: WebsiteHealthSummary }
  | { ok: false; error: string };

/**
 * Load operational events for Admin Website Health.
 * Uses service role (same pattern as other admin data loaders).
 * Phase 4D is read-only and does not expose actor user ids.
 */
export async function getWebsiteHealthSnapshot(limit = 200): Promise<WebsiteHealthSnapshot> {
  try {
    const service = createServiceRoleClient();
    const { data, error } = await service
      .from("operational_events")
      .select(SELECT_COLUMNS)
      .order("last_seen_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    if (error) {
      return { ok: false, error: "Could not load website health events." };
    }

    const events = ((data ?? []) as RawRow[]).map((row) => presentWebsiteHealthEvent(row));
    return {
      ok: true,
      events,
      summary: buildWebsiteHealthSummary(events),
    };
  } catch {
    return { ok: false, error: "Could not load website health events." };
  }
}
