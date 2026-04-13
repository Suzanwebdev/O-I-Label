"use client";

import Link from "next/link";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SuperadminSiteSettingsView } from "@/lib/data/site-settings-superadmin";
import { SUPERADMIN_NAV } from "@/lib/superadmin/nav";

type Props = {
  initialSettings: SuperadminSiteSettingsView;
};

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6 shadow-sm shadow-black/25">
      <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/65">{description}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium text-white">
          {label}
        </Label>
        <p className="text-xs text-white/55">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="shrink-0 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/20"
      />
    </div>
  );
}

export function ControlCenter({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(updates: Record<string, boolean>) {
    setError(null);
    setPending(Object.keys(updates).join(","));
    try {
      const res = await fetch("/api/superadmin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Could not save settings");
      }
      setSettings((prev) => ({
        ...prev,
        maintenance_mode: Boolean(json.maintenance_mode),
        payment_moolre_enabled: Boolean(json.payment_moolre_enabled),
        payment_paystack_enabled: Boolean(json.payment_paystack_enabled),
        payment_flutterwave_enabled: Boolean(json.payment_flutterwave_enabled),
        tax_enabled: Boolean(json.tax_enabled),
        store_name: typeof json.store_name === "string" ? json.store_name : prev.store_name,
        feature_flags:
          json.feature_flags && typeof json.feature_flags === "object" && !Array.isArray(json.feature_flags)
            ? (json.feature_flags as Record<string, unknown>)
            : prev.feature_flags,
        rate_limit_per_min:
          typeof json.rate_limit_per_min === "number" ? json.rate_limit_per_min : prev.rate_limit_per_min,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl text-white md:text-3xl">Control center</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Manage storefront availability, payment providers, and taxes. Changes apply immediately for shoppers
          on their next request.
        </p>
        <p className="mt-2 text-xs text-white/50">
          Store name: <span className="text-white/80">{settings.store_name}</span>
        </p>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Store availability"
          description="When maintenance is on, prepare a maintenance page or banner before enabling in production."
        >
          <ToggleRow
            id="maintenance"
            label="Maintenance mode"
            hint="Visitors may still see cached pages until CDN or hosting cache clears."
            checked={settings.maintenance_mode}
            disabled={busy}
            onCheckedChange={(v) => void patch({ maintenance_mode: v })}
          />
        </Panel>

        <Panel
          title="Checkout & payments"
          description="Control which providers appear at checkout. Secrets stay in environment variables."
        >
          <ToggleRow
            id="moolre"
            label="Moolre"
            hint="Primary Ghana rails when enabled."
            checked={settings.payment_moolre_enabled}
            disabled={busy}
            onCheckedChange={(v) => void patch({ payment_moolre_enabled: v })}
          />
          <ToggleRow
            id="paystack"
            label="Paystack"
            hint="Nigeria and regional cards."
            checked={settings.payment_paystack_enabled}
            disabled={busy}
            onCheckedChange={(v) => void patch({ payment_paystack_enabled: v })}
          />
          <ToggleRow
            id="flutterwave"
            label="Flutterwave"
            hint="Alternative pan-African option."
            checked={settings.payment_flutterwave_enabled}
            disabled={busy}
            onCheckedChange={(v) => void patch({ payment_flutterwave_enabled: v })}
          />
        </Panel>

        <Panel
          title="Taxes"
          description="Turn on tax lines in cart and checkout when your pricing rules are ready."
        >
          <ToggleRow
            id="tax"
            label="Enable tax"
            hint="Pair with configured rates in your commerce settings."
            checked={settings.tax_enabled}
            disabled={busy}
            onCheckedChange={(v) => void patch({ tax_enabled: v })}
          />
        </Panel>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6 shadow-sm shadow-black/25">
          <h2 className="text-base font-semibold tracking-tight text-white">Shortcuts</h2>
          <p className="mt-1 text-sm text-white/65">Jump to the rest of the platform console.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {SUPERADMIN_NAV.filter((n) => n.href !== "/superadmin").map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="flex rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.08]"
                >
                  {n.label}
                  <span className="ml-auto text-white/40">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
