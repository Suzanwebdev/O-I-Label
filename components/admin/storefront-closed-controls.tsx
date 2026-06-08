"use client";

import * as React from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_STOREFRONT_CLOSED_COPY,
  STOREFRONT_CLOSED_PRESET_LABELS,
  STOREFRONT_CLOSED_PRESETS,
  type StorefrontClosedCopy,
  type StorefrontClosedPreset,
  type StorefrontClosedSettings,
} from "@/lib/storefront-closed";

type Variant = "admin" | "superadmin";

type Props = {
  variant: Variant;
  initial: StorefrontClosedSettings;
  /** Superadmin uses the shared site-settings route with extra fields. */
  patchUrl?: string;
};

export function StorefrontClosedControls({ variant, initial, patchUrl }: Props) {
  const endpoint = patchUrl ?? "/api/admin/site-settings";
  const [settings, setSettings] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

  const selectedCopy = settings.storefront_closed_copy[settings.storefront_closed_preset] ?? {};
  const defaultCopy = DEFAULT_STOREFRONT_CLOSED_COPY[settings.storefront_closed_preset];

  async function save(patch: Partial<StorefrontClosedSettings>) {
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Could not save settings");
      }
      setSettings((prev) => ({
        maintenance_mode:
          typeof json.maintenance_mode === "boolean" ? json.maintenance_mode : prev.maintenance_mode,
        storefront_closed_preset:
          typeof json.storefront_closed_preset === "string" &&
          (STOREFRONT_CLOSED_PRESETS as readonly string[]).includes(json.storefront_closed_preset)
            ? (json.storefront_closed_preset as StorefrontClosedPreset)
            : prev.storefront_closed_preset,
        storefront_closed_copy:
          json.storefront_closed_copy && typeof json.storefront_closed_copy === "object"
            ? (json.storefront_closed_copy as StorefrontClosedCopy)
            : prev.storefront_closed_copy,
      }));
      setSaved("Saved");
      window.setTimeout(() => setSaved(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  function updateSelectedCopy(field: "title" | "message", value: string) {
    const preset = settings.storefront_closed_preset;
    setSettings((prev) => ({
      ...prev,
      storefront_closed_copy: {
        ...prev.storefront_closed_copy,
        [preset]: {
          ...prev.storefront_closed_copy[preset],
          [field]: value,
        },
      },
    }));
  }

  const isDark = variant === "superadmin";
  const labelClass = isDark ? "text-white" : "text-foreground";
  const hintClass = isDark ? "text-white/55" : "text-muted-foreground";
  const panelClass = isDark
    ? "rounded-xl border border-white/10 bg-white/[0.04] p-6"
    : "rounded-[var(--radius-lg)] border bg-card p-6";

  return (
    <section className={panelClass}>
      <div className="space-y-1">
        <h2 className={`text-base font-semibold ${labelClass}`}>Store availability</h2>
        <p className={`text-sm leading-relaxed ${hintClass}`}>
          When closed, shoppers are sent to the maintenance page and cannot browse products or checkout.
          Admin and superadmin areas stay available.
        </p>
      </div>

      {error ? (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            isDark
              ? "border-red-400/40 bg-red-950/40 text-red-100"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4 first:border-t-0 first:pt-0">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="storefront-closed" className={`text-sm font-medium ${labelClass}`}>
              Close public storefront
            </Label>
            <p className={`text-xs ${hintClass}`}>
              {settings.maintenance_mode ? "Storefront is closed to customers." : "Storefront is open."}
            </p>
          </div>
          <Switch
            id="storefront-closed"
            checked={settings.maintenance_mode}
            disabled={busy}
            onCheckedChange={(v) => void save({ maintenance_mode: v })}
            className={isDark ? "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/20" : undefined}
          />
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <p className={`text-sm font-medium ${labelClass}`}>Customer message preset</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {STOREFRONT_CLOSED_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={busy}
                onClick={() => void save({ storefront_closed_preset: preset })}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                  settings.storefront_closed_preset === preset
                    ? isDark
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-navy bg-navy/5 text-navy"
                    : isDark
                      ? "border-white/10 bg-white/[0.03] text-white/80 hover:border-white/25"
                      : "border-border bg-background hover:border-navy/30"
                }`}
              >
                {STOREFRONT_CLOSED_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <p className={`text-sm font-medium ${labelClass}`}>
            Message for “{STOREFRONT_CLOSED_PRESET_LABELS[settings.storefront_closed_preset]}”
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="closed-title" className={hintClass}>
                Title
              </Label>
              <Input
                id="closed-title"
                value={selectedCopy.title ?? ""}
                placeholder={defaultCopy.title}
                disabled={busy}
                onChange={(e) => updateSelectedCopy("title", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closed-message" className={hintClass}>
                Message
              </Label>
              <Textarea
                id="closed-message"
                rows={3}
                value={selectedCopy.message ?? ""}
                placeholder={defaultCopy.message}
                disabled={busy}
                onChange={(e) => updateSelectedCopy("message", e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void save({
                    storefront_closed_copy: settings.storefront_closed_copy,
                  })
                }
              >
                Save message
              </Button>
              {saved ? <span className={`text-xs ${hintClass}`}>{saved}</span> : null}
              <Link
                href="/maintenance"
                target="_blank"
                className={`text-xs underline-offset-2 hover:underline ${isDark ? "text-white/70" : "text-navy"}`}
              >
                Preview page
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
