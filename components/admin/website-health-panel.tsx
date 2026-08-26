"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterWebsiteHealthEvents } from "@/lib/website-health/present";
import type {
  WebsiteHealthEventView,
  WebsiteHealthFilters,
  WebsiteHealthSummary,
} from "@/lib/website-health/types";

type Props = {
  events: WebsiteHealthEventView[];
  summary: WebsiteHealthSummary;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function severityClass(severity: WebsiteHealthEventView["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-900 border-red-200";
    case "error":
      return "bg-orange-100 text-orange-900 border-orange-200";
    case "warning":
      return "bg-amber-100 text-amber-950 border-amber-200";
    default:
      return "bg-neutral-100 text-neutral-800 border-neutral-200";
  }
}

function statusClass(status: WebsiteHealthEventView["status"]): string {
  switch (status) {
    case "open":
      return "bg-sky-100 text-sky-900 border-sky-200";
    case "acknowledged":
      return "bg-violet-100 text-violet-900 border-violet-200";
    default:
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
  }
}

function MetaList({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);
  if (!entries.length) {
    return <p className="text-xs text-muted-foreground">No additional context.</p>;
  }
  return (
    <dl className="grid gap-1 text-xs sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded border border-border/70 bg-background px-2 py-1.5">
          <dt className="font-medium text-muted-foreground">{key}</dt>
          <dd className="break-all text-foreground">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WebsiteHealthPanel({ events, summary }: Props) {
  const [status, setStatus] = React.useState<WebsiteHealthFilters["status"]>("open");
  const [severity, setSeverity] = React.useState<WebsiteHealthFilters["severity"]>("all");
  const [category, setCategory] = React.useState<WebsiteHealthFilters["category"]>("all");
  const [query, setQuery] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const filtered = React.useMemo(
    () => filterWebsiteHealthEvents(events, { status, severity, category, query }),
    [events, status, severity, category, query]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Open issues" value={String(summary.openCount)} hint="Unresolved operational events" />
        <SummaryCard
          label="Critical open"
          value={String(summary.criticalOpenCount)}
          hint="Needs immediate attention"
        />
        <SummaryCard
          label="Active in last 24h"
          value={String(summary.activeLast24hCount)}
          hint="Seen again recently"
        />
        <SummaryCard
          label="Open occurrences"
          value={String(summary.totalOccurrencesOpen)}
          hint="Sum of repeats on open events"
        />
      </div>

      {summary.byCategory.length ? (
        <div className="rounded-[var(--radius-lg)] border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">Open by category</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.byCategory.map((row) => (
              <span
                key={row.category}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {row.category}: <span className="font-medium text-foreground">{row.count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background p-4 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="website-health-search">Search</Label>
          <Input
            id="website-health-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Incident ID, fingerprint, message…"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as WebsiteHealthFilters["status"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as WebsiteHealthFilters["severity"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as WebsiteHealthFilters["category"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="checkout">Checkout</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="restock">Restock</SelectItem>
              <SelectItem value="auth">Auth</SelectItem>
              <SelectItem value="api">API</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} event{filtered.length === 1 ? "" : "s"}. Read-only in this phase —
        acknowledge/resolve actions come later.
      </p>

      {!events.length ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
          No operational events recorded yet. Checkout, payment, webhook, inventory, email, restock, and
          auth failures will appear here when they occur.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events match these filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const expanded = expandedId === event.id;
            return (
              <div
                key={event.id}
                className="rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${severityClass(event.severity)}`}>
                        {event.severity}
                      </span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass(event.status)}`}>
                        {event.status}
                      </span>
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                        {event.category} · {event.surface}
                      </span>
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                        ×{event.occurrenceCount}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{event.message}</p>
                    <p className="text-xs text-muted-foreground">
                      Last seen {formatWhen(event.lastSeenAt)} · First seen {formatWhen(event.firstSeenAt)}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Ref {event.incidentId}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-navy underline-offset-4 hover:underline"
                    onClick={() => setExpandedId(expanded ? null : event.id)}
                  >
                    {expanded ? "Hide details" : "Details"}
                  </button>
                </div>
                {expanded ? (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <p className="font-mono text-[11px] break-all text-muted-foreground">
                      Fingerprint: {event.fingerprint}
                    </p>
                    <MetaList metadata={event.metadata} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
