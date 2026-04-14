"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InventoryStockCell({
  variantId,
  stock,
}: {
  variantId: string;
  stock: number;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(String(stock));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      setError("Use a valid stock number");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, stock: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-20"
          inputMode="numeric"
          disabled={busy}
        />
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={save} disabled={busy}>
          Save
        </Button>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}

