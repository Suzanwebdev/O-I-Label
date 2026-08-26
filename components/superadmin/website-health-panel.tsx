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

export type SuperadminPlatformContext = {
  pendingOrders: number;
  processingOrders: number;
  webhookErrors24h: number;
  appErrors24h: number;
};

type Props = {
  events: WebsiteHealthEventView[];
  summary: WebsiteHealthSummary;
  platform: SuperadminPlatformContext;
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
      return "border-red-400/40 bg-red-500/15 text-red-200";
    case "error":
      return "border-orange-400/40 bg-orange-500/15 text-orange-200";
    case "warning":
      return "border-amber-400/40 bg-amber-500/15 text-amber-100";
    default:
      return "border-white/20 bg-white/10 text-white/80";
  }
}

function statusClass(status: WebsiteHealthEventView["status"]): string {
  switch (status) {
    case "open":
      return "border-sky-400/40 bg-sky-500/15 text-sky-100";
    case "acknowledged":
      return "border-violet-400/40 bg-violet-500/15 text-violet-100";
    default:
      return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  }
}

function MetaList({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);
  if (!entries.length) {
    return <p className="text-xs text-white/50">No additional context.</p>;
  }
  return (
    <dl className="grid gap-1 text-xs sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <dt className="font-medium text-white/50">{key}</dt>
          <dd className="break-all text-white/85">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SuperadminWebsiteHealthPanel({ events, summary, platform }: Props) {
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
    <div className="space-y-8">
      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Platform context (24h)</h2>
        <p className="mt-1 text-xs text-white/55">
          Existing System snapshot signals. Operational events below are the Phase 4C capture stream.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ContextCard label="Pending orders" value={String(platform.pendingOrders)} />
          <ContextCard label="Processing orders" value={String(platform.processingOrders)} />
          <ContextCard label="Webhook errors (24h)" value={String(platform.webhookErrors24h)} />
          <ContextCard label="Legacy app errors (24h)" value={String(platform.appErrors24h)} />
        </div>
      </section>

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
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-medium text-white">Open by category</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.byCategory.map((row) => (
              <span
                key={row.category}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/65"
              >
                {row.category}: <span className="font-medium text-white">{row.count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="superadmin-website-health-search" className="text-white/70">
            Search
          </Label>
          <Input
            id="superadmin-website-health-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Incident ID, fingerprint, message…"
            autoComplete="off"
            className="border-white/15 bg-black/40 text-white placeholder:text-white/35"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as WebsiteHealthFilters["status"])}>
            <SelectTrigger className="border-white/15 bg-black/40 text-white">
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
          <Label className="text-white/70">Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as WebsiteHealthFilters["severity"])}>
            <SelectTrigger className="border-white/15 bg-black/40 text-white">
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
          <Label className="text-white/70">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as WebsiteHealthFilters["category"])}>
            <SelectTrigger className="border-white/15 bg-black/40 text-white">
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

      <p className="text-xs text-white/50">
        Showing {filtered.length} event{filtered.length === 1 ? "" : "s"}. Read-only — acknowledge/resolve and
        alerting belong to later phases.
      </p>

      {!events.length ? (
        <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/55">
          No operational events recorded yet. Production failures from checkout, payment, webhook, inventory,
          email, restock, and auth will appear here when captured.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/55">No events match these filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const expanded = expandedId === event.id;
            return (
              <div
                key={event.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
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
                      <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/60">
                        {event.category} · {event.surface}
                      </span>
                      <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/60">
                        ×{event.occurrenceCount}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white">{event.message}</p>
                    <p className="text-xs text-white/50">
                      Last seen {formatWhen(event.lastSeenAt)} · First seen {formatWhen(event.firstSeenAt)}
                    </p>
                    <p className="font-mono text-[11px] text-white/45">Ref {event.incidentId}</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-white underline-offset-4 hover:underline"
                    onClick={() => setExpandedId(expanded ? null : event.id)}
                  >
                    {expanded ? "Hide details" : "Details"}
                  </button>
                </div>
                {expanded ? (
                  <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                    <p className="font-mono text-[11px] break-all text-white/45">
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
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
    </div>
  );
}

function ContextCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
