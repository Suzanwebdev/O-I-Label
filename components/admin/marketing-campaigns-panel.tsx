"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { MarketingCampaign, MarketingChecklistItem } from "@/lib/data/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarRange, Copy, Link2, Pencil, Plus, Trash2 } from "lucide-react";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function buildShopUtmUrl(origin: string, c: Pick<MarketingCampaign, "utm_source" | "utm_medium" | "utm_campaign">) {
  const params = new URLSearchParams();
  if (c.utm_source?.trim()) params.set("utm_source", c.utm_source.trim());
  if (c.utm_medium?.trim()) params.set("utm_medium", c.utm_medium.trim());
  if (c.utm_campaign?.trim()) params.set("utm_campaign", c.utm_campaign.trim());
  const q = params.toString();
  return `${origin.replace(/\/$/, "")}/shop${q ? `?${q}` : ""}`;
}

function formatRange(starts: string | null, ends: string | null): string {
  if (!starts && !ends) return "Dates not set";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (starts && ends) return `${fmt(starts)} → ${fmt(ends)}`;
  if (starts) return `From ${fmt(starts)}`;
  return `Until ${fmt(ends!)}`;
}

const LAUNCH_TEMPLATE: MarketingChecklistItem[] = [
  { id: "t1", label: "Homepage hero / tiles updated", done: false },
  { id: "t2", label: "Discount or promo code live & tested", done: false },
  { id: "t3", label: "Key SKUs in stock (inventory spot-check)", done: false },
  { id: "t4", label: "Social + email scheduled / published", done: false },
];

type Draft = {
  id: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  channelNotes: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  checklist: MarketingChecklistItem[];
};

function emptyDraft(): Draft {
  return {
    id: null,
    title: "",
    startsAt: "",
    endsAt: "",
    channelNotes: "",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    checklist: [],
  };
}

function campaignToDraft(c: MarketingCampaign): Draft {
  return {
    id: c.id,
    title: c.title,
    startsAt: toDatetimeLocalValue(c.starts_at),
    endsAt: toDatetimeLocalValue(c.ends_at),
    channelNotes: c.channel_notes ?? "",
    utmSource: c.utm_source ?? "",
    utmMedium: c.utm_medium ?? "",
    utmCampaign: c.utm_campaign ?? "",
    checklist: c.checklist.length ? c.checklist.map((x) => ({ ...x })) : [],
  };
}

export function MarketingCampaignsPanel({ initialCampaigns }: { initialCampaigns: MarketingCampaign[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = React.useState(initialCampaigns);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCampaigns(initialCampaigns);
  }, [initialCampaigns]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function openCreate() {
    setError(null);
    setDraft(emptyDraft());
    setDialogOpen(true);
  }

  function openEdit(c: MarketingCampaign) {
    setError(null);
    setDraft(campaignToDraft(c));
    setDialogOpen(true);
  }

  function addChecklistRow() {
    setDraft((d) => ({
      ...d,
      checklist: [...d.checklist, { id: `n-${Date.now()}`, label: "", done: false }],
    }));
  }

  function applyLaunchTemplate() {
    setDraft((d) => ({
      ...d,
      checklist: LAUNCH_TEMPLATE.map((x) => ({ ...x, id: `${x.id}-${Date.now()}` })),
    }));
  }

  function updateChecklist(idx: number, patch: Partial<MarketingChecklistItem>) {
    setDraft((d) => ({
      ...d,
      checklist: d.checklist.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  }

  function removeChecklistRow(idx: number) {
    setDraft((d) => ({ ...d, checklist: d.checklist.filter((_, i) => i !== idx) }));
  }

  async function saveDraft() {
    setError(null);
    const title = draft.title.trim();
    if (!title) {
      setError("Campaign title is required.");
      return;
    }
    const payload = {
      title,
      startsAt: fromDatetimeLocalValue(draft.startsAt),
      endsAt: fromDatetimeLocalValue(draft.endsAt),
      channelNotes: draft.channelNotes.trim() || null,
      utmSource: draft.utmSource.trim() || null,
      utmMedium: draft.utmMedium.trim() || null,
      utmCampaign: draft.utmCampaign.trim() || null,
      checklist: draft.checklist.filter((x) => x.label.trim()),
    };

    setBusy(true);
    try {
      if (draft.id) {
        const res = await fetch(`/api/admin/marketing/campaigns/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not update campaign");
          return;
        }
      } else {
        const res = await fetch("/api/admin/marketing/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not create campaign");
          return;
        }
      }
      setDialogOpen(false);
      setDraft(emptyDraft());
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not delete");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function copyUtmLink(c: MarketingCampaign) {
    if (!origin) return;
    const url = buildShopUtmUrl(origin, c);
    void navigator.clipboard.writeText(url);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl tracking-tight">Marketing</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Plan drops on a timeline, keep channel notes with each campaign, run launch checklists, and copy
            shop links with UTM tags for attribution in analytics.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      {error && !dialogOpen ? <p className="text-sm text-red-600">{error}</p> : null}

      {campaigns.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
          No campaigns yet. Create one to add dates, channel notes, a checklist, and UTM parameters.
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const done = c.checklist.filter((x) => x.done).length;
            const total = c.checklist.length;
            return (
              <li
                key={c.id}
                className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{c.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                      {formatRange(c.starts_at, c.ends_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteCampaign(c.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
                {c.channel_notes ? (
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {c.channel_notes}
                  </p>
                ) : null}
                {total > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Checklist:{" "}
                    <span className="font-medium text-foreground">
                      {done}/{total}
                    </span>{" "}
                    done
                  </p>
                ) : null}
                {(c.utm_source || c.utm_medium || c.utm_campaign) && origin ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => copyUtmLink(c)}>
                      <Copy className="h-3.5 w-3.5" />
                      Copy shop link + UTMs
                    </Button>
                    <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                      {buildShopUtmUrl(origin, c)}
                    </code>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit campaign" : "New campaign"}</DialogTitle>
            <DialogDescription>
              Schedule the window, document channels, tick off launch tasks, and set UTMs for your shop link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="space-y-1.5">
              <Label htmlFor="mc-title">Title</Label>
              <Input
                id="mc-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                disabled={busy}
                placeholder="e.g. Summer linen drop"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mc-start">Start (optional)</Label>
                <Input
                  id="mc-start"
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mc-end">End (optional)</Label>
                <Input
                  id="mc-end"
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => setDraft((d) => ({ ...d, endsAt: e.target.value }))}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mc-notes">Channel notes</Label>
              <Textarea
                id="mc-notes"
                value={draft.channelNotes}
                onChange={(e) => setDraft((d) => ({ ...d, channelNotes: e.target.value }))}
                disabled={busy}
                className="min-h-[100px] text-sm"
                placeholder="e.g. Day 1 — IG Reel + Stories. Day 2 — email to VIP list. Homepage banner all week."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Launch checklist</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={applyLaunchTemplate} disabled={busy}>
                    Use template
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addChecklistRow} disabled={busy}>
                    <Plus className="h-3 w-3" />
                    Row
                  </Button>
                </div>
              </div>
              <ul className="space-y-2">
                {draft.checklist.map((row, idx) => (
                  <li key={row.id} className="flex items-start gap-2">
                    <Checkbox
                      checked={row.done}
                      onCheckedChange={(v) => updateChecklist(idx, { done: Boolean(v) })}
                      className="mt-2"
                    />
                    <Input
                      value={row.label}
                      onChange={(e) => updateChecklist(idx, { label: e.target.value })}
                      placeholder="Task description"
                      disabled={busy}
                      className="flex-1"
                    />
                    <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => removeChecklistRow(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Link2 className="h-3.5 w-3.5" />
                Attribution (UTM)
              </p>
              <p className="text-[11px] text-muted-foreground">Used to build a /shop link you can paste in ads, bios, or emails.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">utm_source</Label>
                  <Input
                    value={draft.utmSource}
                    onChange={(e) => setDraft((d) => ({ ...d, utmSource: e.target.value }))}
                    disabled={busy}
                    placeholder="instagram"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">utm_medium</Label>
                  <Input
                    value={draft.utmMedium}
                    onChange={(e) => setDraft((d) => ({ ...d, utmMedium: e.target.value }))}
                    disabled={busy}
                    placeholder="story"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <Label className="text-xs">utm_campaign</Label>
                  <Input
                    value={draft.utmCampaign}
                    onChange={(e) => setDraft((d) => ({ ...d, utmCampaign: e.target.value }))}
                    disabled={busy}
                    placeholder="summer-linen-2026"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              {origin && (draft.utmSource || draft.utmMedium || draft.utmCampaign) ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-1 w-full gap-1.5 text-xs"
                  onClick={() => {
                    const url = buildShopUtmUrl(origin, {
                      utm_source: draft.utmSource,
                      utm_medium: draft.utmMedium,
                      utm_campaign: draft.utmCampaign,
                    });
                    void navigator.clipboard.writeText(url);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy preview link
                </Button>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={saveDraft} disabled={busy}>
              {busy ? "Saving…" : draft.id ? "Save changes" : "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
