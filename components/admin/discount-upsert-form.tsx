"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { AdminDiscountRow } from "@/lib/data/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Kind = "percent" | "fixed" | "free_shipping";

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoFromLocal(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function DiscountUpsertForm({
  existing,
  onSuccess,
  className,
}: {
  existing?: AdminDiscountRow | null;
  onSuccess?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(existing);

  const [code, setCode] = React.useState(existing?.code ?? "");
  const [kind, setKind] = React.useState<Kind>(existing?.kind ?? "percent");
  const [value, setValue] = React.useState(() => {
    if (!existing) return "";
    if (existing.kind === "free_shipping") return "";
    return existing.value != null ? String(existing.value) : "";
  });
  const [minSpend, setMinSpend] = React.useState(
    existing?.min_spend_ghs != null ? String(existing.min_spend_ghs) : ""
  );
  const [usageLimit, setUsageLimit] = React.useState(
    existing?.usage_limit != null ? String(existing.usage_limit) : ""
  );
  const [startsLocal, setStartsLocal] = React.useState(toDatetimeLocal(existing?.starts_at ?? null));
  const [endsLocal, setEndsLocal] = React.useState(toDatetimeLocal(existing?.ends_at ?? null));
  const [isActive, setIsActive] = React.useState(existing?.is_active ?? true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!existing) return;
    setCode(existing.code);
    setKind(existing.kind);
    setValue(existing.kind === "free_shipping" ? "" : existing.value != null ? String(existing.value) : "");
    setMinSpend(existing.min_spend_ghs != null ? String(existing.min_spend_ghs) : "");
    setUsageLimit(existing.usage_limit != null ? String(existing.usage_limit) : "");
    setStartsLocal(toDatetimeLocal(existing.starts_at));
    setEndsLocal(toDatetimeLocal(existing.ends_at));
    setIsActive(existing.is_active);
    setError(null);
  }, [existing?.id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startsAt = isoFromLocal(startsLocal);
    const endsAt = isoFromLocal(endsLocal);
    if (startsLocal.trim() && !startsAt) {
      setError("Start time is not a valid date.");
      return;
    }
    if (endsLocal.trim() && !endsAt) {
      setError("End time is not a valid date.");
      return;
    }

    let valuePayload: number | null = null;
    if (kind === "percent" || kind === "fixed") {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) {
        setError(kind === "percent" ? "Enter a percent between 1 and 100." : "Enter an amount greater than 0.");
        return;
      }
      if (kind === "percent" && n > 100) {
        setError("Percent cannot exceed 100.");
        return;
      }
      valuePayload = n;
    }

    const minSpendGhs = minSpend.trim() === "" ? null : Number(minSpend);
    if (minSpend.trim() !== "" && (!Number.isFinite(minSpendGhs) || (minSpendGhs as number) < 0)) {
      setError("Minimum spend must be empty or a non-negative number.");
      return;
    }

    let usageLimitPayload: number | null = null;
    if (usageLimit.trim() !== "") {
      const u = Number(usageLimit);
      if (!Number.isInteger(u) || u < 1) {
        setError("Usage limit must be a whole number ≥ 1, or empty for unlimited.");
        return;
      }
      usageLimitPayload = u;
    }

    const payload = {
      code: code.trim(),
      kind,
      value: kind === "free_shipping" ? null : valuePayload,
      minSpendGhs: minSpend.trim() === "" ? null : minSpendGhs,
      usageLimit: usageLimitPayload,
      startsAt,
      endsAt,
      isActive,
    };

    setBusy(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit && existing
            ? { discountId: existing.id, ...payload }
            : payload
        ),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Request failed");
        return;
      }
      if (!isEdit) {
        setCode("");
        setKind("percent");
        setValue("");
        setMinSpend("");
        setUsageLimit("");
        setStartsLocal("");
        setEndsLocal("");
        setIsActive(true);
      }
      router.refresh();
      onSuccess?.();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const valueHint =
    kind === "percent"
      ? "Percent off cart subtotal (1–100)."
      : kind === "fixed"
        ? "Amount in GH₵ deducted from subtotal."
        : "Shipping waived when checkout applies this code (checkout still needs wiring).";

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2 md:col-span-1">
          <Label htmlFor="disc-code">Promo code</Label>
          <Input
            id="disc-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SPRING26"
            required
            disabled={busy}
            autoComplete="off"
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">Stored uppercase. Shoppers can type any case.</p>
        </div>
        <div className="space-y-2">
          <Label>Discount type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)} disabled={busy}>
            <SelectTrigger id="disc-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percent off order</SelectItem>
              <SelectItem value="fixed">Fixed GH₵ off order</SelectItem>
              <SelectItem value="free_shipping">Free shipping</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{valueHint}</p>
        </div>
      </div>

      {kind !== "free_shipping" ? (
        <div className="space-y-2">
          <Label htmlFor="disc-value">{kind === "percent" ? "Percent (%)" : "Amount (GH₵)"}</Label>
          <Input
            id="disc-value"
            type="number"
            min={kind === "percent" ? 1 : 0.01}
            max={kind === "percent" ? 100 : undefined}
            step={kind === "percent" ? 1 : 0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            disabled={busy}
          />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="disc-min">Minimum order (GH₵)</Label>
          <Input
            id="disc-min"
            type="number"
            min="0"
            step="0.01"
            value={minSpend}
            onChange={(e) => setMinSpend(e.target.value)}
            placeholder="Optional"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="disc-limit">Max redemptions</Label>
          <Input
            id="disc-limit"
            type="number"
            min="1"
            step="1"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="Unlimited if empty"
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="disc-start">Starts (local)</Label>
          <Input
            id="disc-start"
            type="datetime-local"
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="disc-end">Ends (local)</Label>
          <Input
            id="disc-end"
            type="datetime-local"
            value={endsLocal}
            onChange={(e) => setEndsLocal(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        <Switch id="disc-active" checked={isActive} onCheckedChange={setIsActive} disabled={busy} />
        <Label htmlFor="disc-active" className="text-sm font-normal">
          Code is eligible when active and inside the window
        </Label>
      </div>

      {existing ? (
        <p className="text-xs text-muted-foreground">
          Redeemed <span className="font-medium text-foreground">{existing.used_count}</span> time
          {existing.used_count === 1 ? "" : "s"} (read-only counter).
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save discount" : "Create discount"}
        </Button>
      </div>
    </form>
  );
}
