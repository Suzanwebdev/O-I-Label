import type {
  OperationalCategory,
  OperationalEventStatus,
  OperationalSeverity,
  OperationalSurface,
} from "@/lib/errors/capture-event";

export type WebsiteHealthEventView = {
  id: string;
  incidentId: string;
  fingerprint: string;
  severity: OperationalSeverity;
  category: OperationalCategory;
  surface: OperationalSurface;
  message: string;
  metadata: Record<string, unknown>;
  occurrenceCount: number;
  status: OperationalEventStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
};

export type WebsiteHealthSummary = {
  openCount: number;
  criticalOpenCount: number;
  errorOpenCount: number;
  warningOpenCount: number;
  activeLast24hCount: number;
  totalOccurrencesOpen: number;
  byCategory: Array<{ category: OperationalCategory; count: number }>;
};

export type WebsiteHealthFilters = {
  status: "all" | OperationalEventStatus;
  severity: "all" | OperationalSeverity;
  category: "all" | OperationalCategory;
  query: string;
};
