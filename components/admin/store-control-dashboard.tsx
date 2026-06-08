"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  STORE_STATUS_DESCRIPTIONS,
  STORE_STATUS_LABELS,
} from "@/lib/store-control/constants";
import { STORE_STATUSES, type EffectiveStoreControl, type StoreBannerRow, type StoreSettingsRow } from "@/lib/store-control/types";

type Snapshot = {
  settings: StoreSettingsRow;
  control: EffectiveStoreControl;
  banners: StoreBannerRow[];
  whitelist: Array<{ id: string; email: string; note: string | null }>;
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

export function StoreControlDashboard({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = React.useState(initial);
  const [settings, setSettings] = React.useState(initial.settings);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [bannerText, setBannerText] = React.useState("");
  const [whitelistEmail, setWhitelistEmail] = React.useState("");

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

  async function addBanner() {
    if (!bannerText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/store-control/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bannerText.trim(), enabled: true }),
      });
      const json = (await res.json()) as { banner?: StoreBannerRow; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not add banner");
      if (json.banner) {
        setSnapshot((prev) => ({ ...prev, banners: [...prev.banners, json.banner!] }));
        setBannerText("");
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif-display text-3xl tracking-tight">Store Control</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage storefront availability, launch modes, and customer messaging — no deploy required.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/closed/${previewSlug}`} target="_blank" rel="noreferrer">
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-[var(--radius-lg)] lg:col-span-2">
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
              return (
                <button
                  key={status}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSettings((s) => ({ ...s, store_status: status }));
                    void save({ store_status: status, apply_recommended_flags: true });
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-black bg-black text-white shadow-md"
                      : "border-border bg-background hover:border-black/30"
                  }`}
                >
                  <p className="text-sm font-semibold">{STORE_STATUS_LABELS[status]}</p>
                  <p className={`mt-1 text-xs leading-relaxed ${active ? "text-white/75" : "text-muted-foreground"}`}>
                    {STORE_STATUS_DESCRIPTIONS[status]}
                  </p>
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="browsing">Browsing enabled</Label>
                <p className="text-xs text-muted-foreground">Shop, products, homepage</p>
              </div>
              <Switch
                id="browsing"
                checked={settings.browsing_enabled}
                disabled={busy}
                onCheckedChange={(v) => {
                  setSettings((s) => ({ ...s, browsing_enabled: v }));
                  void save({ browsing_enabled: v });
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="checkout">Checkout enabled</Label>
                <p className="text-xs text-muted-foreground">Cart & payment APIs</p>
              </div>
              <Switch
                id="checkout"
                checked={settings.checkout_enabled}
                disabled={busy}
                onCheckedChange={(v) => {
                  setSettings((s) => ({ ...s, checkout_enabled: v }));
                  void save({ checkout_enabled: v });
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="countdown">Countdown enabled</Label>
                <p className="text-xs text-muted-foreground">Launch / reopen timers</p>
              </div>
              <Switch
                id="countdown"
                checked={settings.countdown_enabled}
                disabled={busy}
                onCheckedChange={(v) => {
                  setSettings((s) => ({ ...s, countdown_enabled: v }));
                  void save({ countdown_enabled: v });
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[var(--radius-lg)]">
          <CardHeader>
            <CardTitle className="text-base">Customer message</CardTitle>
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
                placeholder="We're refining the O & I Label experience."
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
                  presale_cta_label: settings.presale_cta_label,
                })
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save messaging"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[var(--radius-lg)]">
          <CardHeader>
            <CardTitle className="text-base">Dates & scheduling</CardTitle>
            <CardDescription>Launch, presale, reopening, and automatic transitions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <Button
              disabled={busy}
              className="mt-2"
              onClick={() =>
                void save({
                  launch_date: settings.launch_date,
                  presale_date: settings.presale_date,
                  reopening_date: settings.reopening_date,
                  scheduled_activate_at: settings.scheduled_activate_at,
                  scheduled_deactivate_at: settings.scheduled_deactivate_at,
                  scheduled_status:
                    settings.scheduled_status ?? (settings.store_status !== "live" ? settings.store_status : "maintenance"),
                  revert_status: settings.revert_status,
                })
              }
            >
              Save schedule
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[var(--radius-lg)]">
          <CardHeader>
            <CardTitle className="text-base">Announcement banners</CardTitle>
            <CardDescription>Site-wide strip above the header.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder='e.g. "Launching May 30"'
                value={bannerText}
                onChange={(e) => setBannerText(e.target.value)}
              />
              <Button type="button" disabled={busy} onClick={() => void addBanner()}>
                Add
              </Button>
            </div>
            <ul className="space-y-2">
              {snapshot.banners.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{b.text}</span>
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
                        banners: prev.banners.map((x) => (x.id === b.id ? { ...x, enabled: v } : x)),
                      }));
                    }}
                  />
                </li>
              ))}
              {snapshot.banners.length === 0 ? (
                <li className="text-sm text-muted-foreground">No scheduled banners yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-[var(--radius-lg)]">
          <CardHeader>
            <CardTitle className="text-base">Private access</CardTitle>
            <CardDescription>VIP preview — whitelist emails and optional password.</CardDescription>
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
    </div>
  );
}
