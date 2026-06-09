"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Eye, Loader2, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StoreHeroImageUpload } from "@/components/admin/store-hero-image-upload";
import {
  STORE_CAMPAIGN_SUBJECTS,
  STORE_STATUS_VISUAL,
  STORE_STATUS_LABELS,
} from "@/lib/store-control/constants";
import {
  STORE_STATUSES,
  type EffectiveStoreControl,
  type StoreBannerRow,
  type StoreControlAnalytics,
  type StoreSettingsRow,
  type StoreStatus,
  type StoreWaitlistRow,
} from "@/lib/store-control/types";

type Snapshot = {
  settings: StoreSettingsRow;
  control: EffectiveStoreControl;
  banners: StoreBannerRow[];
  whitelist: Array<{ id: string; email: string; note: string | null }>;
  analytics: StoreControlAnalytics;
  waitlistCount: number;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

const TABS = ["overview", "messaging", "waitlist", "communications"] as const;
type Tab = (typeof TABS)[number];

export function StoreControlDashboard({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = React.useState(initial);
  const [settings, setSettings] = React.useState(initial.settings);
  const [tab, setTab] = React.useState<Tab>("overview");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [bannerText, setBannerText] = React.useState("");
  const [bannerHref, setBannerHref] = React.useState("");
  const [whitelistEmail, setWhitelistEmail] = React.useState("");
  const [pendingStatus, setPendingStatus] = React.useState<StoreStatus | null>(null);
  const [waitlistQ, setWaitlistQ] = React.useState("");
  const [waitlistPage, setWaitlistPage] = React.useState(1);
  const [waitlistRows, setWaitlistRows] = React.useState<StoreWaitlistRow[]>([]);
  const [waitlistTotal, setWaitlistTotal] = React.useState(initial.waitlistCount);
  const [campaignPreview, setCampaignPreview] = React.useState<string | null>(null);
  const [customCampaignHtml, setCustomCampaignHtml] = React.useState("");
  const [emailPreviewHtml, setEmailPreviewHtml] = React.useState<string | null>(null);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/store-control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as {
        settings?: StoreSettingsRow;
        control?: EffectiveStoreControl;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      if (json.settings) setSettings(json.settings);
      if (json.settings && json.control) {
        setSnapshot((prev) => ({
          ...prev,
          settings: json.settings!,
          control: json.control!,
        }));
      }
      setNotice("Saved — changes are live.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    setSettings((s) => ({ ...s, store_status: pendingStatus }));
    await save({ store_status: pendingStatus, apply_recommended_flags: true });
    setPendingStatus(null);
  }

  async function loadWaitlist(page = waitlistPage) {
    const res = await fetch(
      `/api/admin/store-control/waitlist?q=${encodeURIComponent(waitlistQ)}&page=${page}&pageSize=25`
    );
    const json = (await res.json()) as { rows?: StoreWaitlistRow[]; total?: number };
    setWaitlistRows(json.rows ?? []);
    setWaitlistTotal(json.total ?? 0);
    setWaitlistPage(page);
  }

  React.useEffect(() => {
    if (tab === "waitlist") void loadWaitlist(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function addBanner() {
    if (!bannerText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/store-control/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: bannerText.trim(),
          href: bannerHref.trim() || null,
          enabled: true,
          sort_order: snapshot.banners.length,
        }),
      });
      const json = (await res.json()) as { banner?: StoreBannerRow; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not add banner");
      if (json.banner) {
        setSnapshot((prev) => ({ ...prev, banners: [...prev.banners, json.banner!] }));
        setBannerText("");
        setBannerHref("");
      }
      setNotice("Banner added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add banner");
    } finally {
      setBusy(false);
    }
  }

  async function addWhitelist() {
    if (!whitelistEmail.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/store-control/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: whitelistEmail.trim() }),
      });
      const json = (await res.json()) as { entry?: Snapshot["whitelist"][0]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not add email");
      if (json.entry) {
        setSnapshot((prev) => ({ ...prev, whitelist: [json.entry!, ...prev.whitelist] }));
        setWhitelistEmail("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add email");
    } finally {
      setBusy(false);
    }
  }

  async function runCampaign(action: "preview" | "send", campaignType: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/store-control/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          campaignType,
          customHtml: campaignType === "custom" ? customCampaignHtml : undefined,
        }),
      });
      const json = (await res.json()) as {
        preview?: boolean;
        html?: string;
        subject?: string;
        result?: { sentCount: number; failedCount: number; recipientCount: number };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Campaign failed");
      if (action === "preview" && json.html) {
        setEmailPreviewHtml(json.html);
        setCampaignPreview(json.subject ?? null);
      } else if (json.result) {
        setNotice(
          `Campaign sent — ${json.result.sentCount}/${json.result.recipientCount} delivered.`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Campaign failed");
    } finally {
      setBusy(false);
    }
  }

  const previewSlug =
    settings.store_status === "presale"
      ? "presale"
      : settings.store_status === "pre_launch"
        ? "pre-launch"
        : settings.store_status === "holiday_break"
          ? "holiday"
          : settings.store_status === "inventory_update"
            ? "inventory"
            : settings.store_status === "private_access"
              ? "private-access"
              : "maintenance";

  const analytics = snapshot.analytics;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif-display text-3xl tracking-tight">Store Control</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage storefront availability, launch modes, VIP waitlist, and customer messaging — no
            deploy required.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/closed/${previewSlug}`} target="_blank" rel="noreferrer">
              <Eye className="mr-2 h-3.5 w-3.5" />
              Preview status page
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/" target="_blank" rel="noreferrer">
              View storefront
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition ${
              tab === t
                ? "bg-black text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Waitlist subscribers", value: analytics.waitlistTotal, icon: Users },
              { label: "New waitlist (30d)", value: analytics.waitlistLast30d, icon: Users },
              { label: "Orders (30d)", value: analytics.ordersLast30d, icon: Mail },
              {
                label: "Revenue (30d)",
                value: `GH₵${analytics.revenueLast30d.toLocaleString()}`,
                icon: Mail,
              },
            ].map((card) => (
              <Card key={card.label} className="rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]">
                <CardContent className="flex items-center gap-3 p-5">
                  <div className="rounded-full bg-muted p-2.5">
                    <card.icon className="h-4 w-4 text-foreground/70" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="font-serif-display text-2xl">{card.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Presale signups (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif-display text-2xl">{analytics.presaleSignupsLast30d}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Launch signups (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif-display text-2xl">{analytics.launchSignupsLast30d}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Conversion rate (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif-display text-2xl">{analytics.conversionRateLast30d}%</p>
                <p className="mt-1 text-xs text-muted-foreground">Paid orders ÷ waitlist signups</p>
              </CardContent>
            </Card>
            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Paid orders (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif-display text-2xl">{analytics.paidOrdersLast30d}</p>
              </CardContent>
            </Card>
          </div>

          {analytics.topTrafficSources.length > 0 ? (
            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader>
                <CardTitle className="text-base">Top waitlist sources (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {analytics.topTrafficSources.map((s) => (
                    <li key={s.source} className="flex justify-between border-b border-border py-2 last:border-0">
                      <span className="text-muted-foreground">{s.source}</span>
                      <span className="font-medium">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="rounded-[var(--radius-lg)] lg:col-span-2 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle className="text-base">Store status</CardTitle>
                <CardDescription>
                  Current:{" "}
                  <span className="font-medium text-foreground">
                    {STORE_STATUS_LABELS[snapshot.control.storeStatus]}
                  </span>
                  {snapshot.control.isLive ? " — live" : " — restricted"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {STORE_STATUSES.map((status) => {
                  const active = settings.store_status === status;
                  const visual = STORE_STATUS_VISUAL[status];
                  const Icon = visual.icon;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={busy}
                      onClick={() => setPendingStatus(status)}
                      className={`group relative rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-md ${
                        active
                          ? `border-black/80 bg-black text-white ring-2 ${visual.ring}`
                          : `${visual.accent} hover:border-black/25`
                      }`}
                    >
                      {active ? (
                        <span className="absolute right-3 top-3 rounded-full bg-white/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em]">
                          Active
                        </span>
                      ) : (
                        <span className="absolute right-3 top-3 rounded-full bg-black/5 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground opacity-0 transition group-hover:opacity-100">
                          Preview
                        </span>
                      )}
                      <div className="flex items-start gap-3">
                        <div
                          className={`rounded-lg p-2 ${active ? "bg-white/10" : visual.badge}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 pr-12">
                          <p className="text-sm font-semibold">{visual.label}</p>
                          <p
                            className={`mt-1 text-xs leading-relaxed ${
                              active ? "text-white/75" : "text-muted-foreground"
                            }`}
                          >
                            {visual.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader>
                <CardTitle className="text-base">Access toggles</CardTitle>
                <CardDescription>Fine-grained control independent of status presets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {(
                  [
                    ["browsing_enabled", "Browsing enabled", "Shop, products, homepage"],
                    ["checkout_enabled", "Checkout enabled", "Cart & payment APIs"],
                    ["countdown_enabled", "Countdown enabled", "Launch / reopen timers"],
                    ["show_waitlist_count", "Show waitlist count", "Social proof on presale pages"],
                    ["maintenance_use_503", "Maintenance HTTP 503", "SEO-safe closure signal"],
                  ] as const
                ).map(([key, label, hint]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div>
                      <Label>{label}</Label>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                    <Switch
                      checked={Boolean(settings[key])}
                      disabled={busy}
                      onCheckedChange={(v) => {
                        setSettings((s) => ({ ...s, [key]: v }));
                        void save({ [key]: v });
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[var(--radius-lg)]">
            <CardHeader>
              <CardTitle className="text-base">Automation</CardTitle>
              <CardDescription>
                Schedule automatic mode transitions — timezone: {settings.scheduled_timezone}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {(
                  [
                    ["launch_date", "Launch date"],
                    ["presale_date", "Presale date"],
                    ["reopening_date", "Reopening date"],
                    ["scheduled_activate_at", "Schedule activate at"],
                    ["scheduled_deactivate_at", "Schedule revert at"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      type="datetime-local"
                      value={toLocalInput(settings[key])}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, [key]: fromLocalInput(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Scheduled target mode</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={settings.scheduled_status ?? ""}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        scheduled_status: (e.target.value || null) as StoreStatus | null,
                      }))
                    }
                  >
                    <option value="">—</option>
                    {STORE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STORE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Revert to mode</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={settings.revert_status}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        revert_status: e.target.value as StoreStatus,
                      }))
                    }
                  >
                    {STORE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STORE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tz">Timezone</Label>
                  <Input
                    id="tz"
                    value={settings.scheduled_timezone}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, scheduled_timezone: e.target.value }))
                    }
                    placeholder="Africa/Accra"
                  />
                </div>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void save({
                      launch_date: settings.launch_date,
                      presale_date: settings.presale_date,
                      reopening_date: settings.reopening_date,
                      scheduled_activate_at: settings.scheduled_activate_at,
                      scheduled_deactivate_at: settings.scheduled_deactivate_at,
                      scheduled_status: settings.scheduled_status,
                      scheduled_timezone: settings.scheduled_timezone,
                      revert_status: settings.revert_status,
                    })
                  }
                >
                  Save schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {tab === "messaging" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-[var(--radius-lg)]">
            <CardHeader>
              <CardTitle className="text-base">Customer messaging</CardTitle>
              <CardDescription>Luxury copy shown on status pages and checkout blocks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message">Headline / message</Label>
                <Textarea
                  id="message"
                  rows={3}
                  value={settings.maintenance_message ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maintenance_message: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supporting">Supporting text</Label>
                <Textarea
                  id="supporting"
                  rows={3}
                  value={settings.supporting_message ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, supporting_message: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="presale-cta">Presale button label</Label>
                <Input
                  id="presale-cta"
                  value={settings.presale_cta_label}
                  onChange={(e) => setSettings((s) => ({ ...s, presale_cta_label: e.target.value }))}
                />
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  void save({
                    maintenance_message: settings.maintenance_message,
                    supporting_message: settings.supporting_message,
                    presale_cta_label: settings.presale_cta_label,
                  })
                }
              >
                Save messaging
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <StoreHeroImageUpload
              label="Presale hero image"
              value={settings.presale_hero_image_url}
              disabled={busy}
              onChange={(url) => {
                setSettings((s) => ({ ...s, presale_hero_image_url: url }));
                void save({ presale_hero_image_url: url });
              }}
            />
            <StoreHeroImageUpload
              label="Maintenance hero image"
              value={settings.maintenance_hero_image_url}
              disabled={busy}
              onChange={(url) => {
                setSettings((s) => ({ ...s, maintenance_hero_image_url: url }));
                void save({ maintenance_hero_image_url: url });
              }}
            />
            <StoreHeroImageUpload
              label="Launch hero image"
              value={settings.launch_hero_image_url}
              disabled={busy}
              onChange={(url) => {
                setSettings((s) => ({ ...s, launch_hero_image_url: url }));
                void save({ launch_hero_image_url: url });
              }}
            />
          </div>

          <Card className="rounded-[var(--radius-lg)] lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Announcement banners</CardTitle>
              <CardDescription>Multiple banners with schedule, priority, and preview.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder='e.g. "Presale Opens June 15"'
                  value={bannerText}
                  onChange={(e) => setBannerText(e.target.value)}
                />
                <Input
                  placeholder="Optional link URL"
                  value={bannerHref}
                  onChange={(e) => setBannerHref(e.target.value)}
                />
                <Button type="button" disabled={busy} onClick={() => void addBanner()}>
                  Add banner
                </Button>
              </div>
              <ul className="space-y-3">
                {snapshot.banners
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((b) => (
                    <li
                      key={b.id}
                      className="rounded-lg border border-border bg-background/50 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{b.text}</span>
                        <Switch
                          checked={b.enabled}
                          onCheckedChange={async (v) => {
                            await fetch("/api/admin/store-control/banners", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: b.id, enabled: v }),
                            });
                            setSnapshot((prev) => ({
                              ...prev,
                              banners: prev.banners.map((x) =>
                                x.id === b.id ? { ...x, enabled: v } : x
                              ),
                            }));
                          }}
                        />
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <Input
                          type="datetime-local"
                          defaultValue={toLocalInput(b.starts_at)}
                          onBlur={async (e) => {
                            await fetch("/api/admin/store-control/banners", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: b.id,
                                starts_at: fromLocalInput(e.target.value),
                              }),
                            });
                          }}
                        />
                        <Input
                          type="datetime-local"
                          defaultValue={toLocalInput(b.ends_at)}
                          onBlur={async (e) => {
                            await fetch("/api/admin/store-control/banners", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: b.id,
                                ends_at: fromLocalInput(e.target.value),
                              }),
                            });
                          }}
                        />
                        <Input
                          type="number"
                          defaultValue={b.sort_order}
                          placeholder="Priority"
                          onBlur={async (e) => {
                            const sort_order = Number(e.target.value);
                            await fetch("/api/admin/store-control/banners", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: b.id, sort_order }),
                            });
                            setSnapshot((prev) => ({
                              ...prev,
                              banners: prev.banners.map((x) =>
                                x.id === b.id ? { ...x, sort_order } : x
                              ),
                            }));
                          }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-[var(--radius-lg)]">
            <CardHeader>
              <CardTitle className="text-base">Private access</CardTitle>
              <CardDescription>VIP preview — whitelist, password, and access logging.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access-password">Preview password</Label>
                <Input
                  id="access-password"
                  type="password"
                  placeholder="Set or change password"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) void save({ private_access_password: v });
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Whitelist email"
                  value={whitelistEmail}
                  onChange={(e) => setWhitelistEmail(e.target.value)}
                />
                <Button type="button" disabled={busy} onClick={() => void addWhitelist()}>
                  Add
                </Button>
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {snapshot.whitelist.map((w) => (
                  <li key={w.id} className="text-muted-foreground">
                    {w.email}
                  </li>
                ))}
              </ul>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="instagram">Instagram URL</Label>
                  <Input
                    id="instagram"
                    value={settings.instagram_url ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, instagram_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="whatsapp">WhatsApp URL</Label>
                  <Input
                    id="whatsapp"
                    value={settings.whatsapp_url ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, whatsapp_url: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() =>
                  void save({
                    instagram_url: settings.instagram_url,
                    whatsapp_url: settings.whatsapp_url,
                  })
                }
              >
                Save links
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "waitlist" ? (
        <Card className="rounded-[var(--radius-lg)]">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Waitlist subscribers</CardTitle>
              <CardDescription>{waitlistTotal.toLocaleString()} total subscribers</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/api/admin/store-control/waitlist?export=csv">Export CSV</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search name or email"
                value={waitlistQ}
                onChange={(e) => setWaitlistQ(e.target.value)}
              />
              <Button type="button" onClick={() => void loadWaitlist(1)}>
                Search
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Country</th>
                    <th className="px-3 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlistRows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{r.first_name}</td>
                      <td className="px-3 py-2">{r.email_raw}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.phone_e164 ?? "—"}</td>
                      <td className="px-3 py-2">{r.country_iso}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {waitlistRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No subscribers yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={waitlistPage <= 1}
                onClick={() => void loadWaitlist(waitlistPage - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {waitlistPage} · {waitlistTotal} total
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={waitlistPage * 25 >= waitlistTotal}
                onClick={() => void loadWaitlist(waitlistPage + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "communications" ? (
        <Card className="rounded-[var(--radius-lg)]">
          <CardHeader>
            <CardTitle className="text-base">Waitlist communications</CardTitle>
            <CardDescription>Preview and send branded campaigns via Resend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["waitlist_welcome", "Notify waitlist"],
                  ["presale_opening", "Send presale reminder"],
                  ["launch_day", "Send launch reminder"],
                  ["store_reopening", "Send reopening notice"],
                  ["maintenance_complete", "Maintenance complete"],
                ] as const
              ).map(([type, label]) => (
                <div
                  key={type}
                  className="flex flex-col gap-2 rounded-xl border border-border p-4"
                >
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{STORE_CAMPAIGN_SUBJECTS[type]}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void runCampaign("preview", type)}
                    >
                      Preview
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void runCampaign("send", type)}>
                      Send
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Custom campaign</p>
              <Textarea
                className="mt-2"
                rows={4}
                placeholder="HTML or plain text body for custom campaign"
                value={customCampaignHtml}
                onChange={(e) => setCustomCampaignHtml(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void runCampaign("preview", "custom")}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  disabled={busy || !customCampaignHtml.trim()}
                  onClick={() => void runCampaign("send", "custom")}
                >
                  Send custom
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={pendingStatus !== null} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change store status?</DialogTitle>
            <DialogDescription>
              {pendingStatus
                ? `Switch to ${STORE_STATUS_LABELS[pendingStatus]}? Recommended access flags will be applied immediately.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingStatus(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void confirmStatusChange()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!emailPreviewHtml} onOpenChange={(open) => !open && setEmailPreviewHtml(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            {campaignPreview ? (
              <DialogDescription>Subject: {campaignPreview}</DialogDescription>
            ) : null}
          </DialogHeader>
          {emailPreviewHtml ? (
            <iframe
              title="Email preview"
              className="h-[60vh] w-full rounded-lg border"
              srcDoc={emailPreviewHtml}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
