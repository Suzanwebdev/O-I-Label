"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CategoryRowActions } from "@/components/admin/category-row-actions";

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
};

export function CategoriesManager({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(categories);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setItems(categories);
  }, [categories]);

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    const [picked] = copy.splice(index, 1);
    copy.splice(next, 0, picked);
    setItems(copy);
  }

  async function saveOrder() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: items.map((i) => i.id) }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save order");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while saving order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Reorder category cards with arrows, then click Save order.
        </p>
        <Button size="sm" disabled={busy || !items.length} onClick={() => void saveOrder()}>
          {busy ? "Saving..." : "Save order"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {items.map((c, index) => (
        <div key={c.id} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{c.name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">/{c.slug}</p>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => move(index, -1)} disabled={index === 0 || busy}>
                ↑
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1 || busy}
              >
                ↓
              </Button>
            </div>
          </div>
          {c.description ? <p className="mt-1 text-xs text-muted-foreground">{c.description}</p> : null}
          <div className="mt-3">
            <CategoryRowActions categoryId={c.id} initialName={c.name} initialImageUrl={c.image_url ?? null} />
          </div>
        </div>
      ))}
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No categories yet.</p> : null}
    </div>
  );
}
