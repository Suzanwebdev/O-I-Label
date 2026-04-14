"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function CollectionCreateForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [isSmart, setIsSmart] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, is_smart: isSmart }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not create collection");
        return;
      }
      setTitle("");
      setSlug("");
      setIsSmart(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Collection title"
          required
          disabled={busy}
          className="min-w-[220px] flex-1"
        />
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Slug (optional)"
          disabled={busy}
          className="min-w-[220px] flex-1"
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Adding..." : "Add"}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="smart-collection" checked={isSmart} onCheckedChange={setIsSmart} disabled={busy} />
        <Label htmlFor="smart-collection" className="text-xs text-muted-foreground">
          Smart collection (rules-based)
        </Label>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}

