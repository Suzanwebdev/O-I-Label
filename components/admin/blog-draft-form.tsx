"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BlogDraftForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not create post");
        return;
      }
      setTitle("");
      setSlug("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        className="min-w-[220px] flex-1"
        required
        disabled={busy}
      />
      <Input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="Slug (optional)"
        className="min-w-[220px] flex-1"
        disabled={busy}
      />
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Creating..." : "Create draft"}
      </Button>
      {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
    </form>
  );
}

