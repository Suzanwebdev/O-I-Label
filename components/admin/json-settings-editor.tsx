"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  endpoint: string;
  field: "sections" | "featureFlags";
  label: string;
  initialJson: string;
};

export function JsonSettingsEditor({ endpoint, field, label, initialJson }: Props) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialJson);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  async function save() {
    setError(null);
    setOk(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError("Invalid JSON format");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("JSON must be an object");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: parsed }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save");
        return;
      }
      setOk("Saved successfully");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[260px] font-mono text-xs"
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving..." : "Save JSON"}
        </Button>
        {ok ? <span className="text-xs text-emerald-600">{ok}</span> : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}

