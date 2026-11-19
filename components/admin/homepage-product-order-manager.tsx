"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { shouldBypassImageOptimization } from "@/lib/media-quality";

export type HomepageOrderProduct = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  isBestSeller: boolean;
};

export function HomepageProductOrderManager({ products }: { products: HomepageOrderProduct[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(products);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setItems(products);
  }, [products]);

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    const [picked] = copy.splice(index, 1);
    copy.splice(next, 0, picked);
    setItems(copy);
    setSaved(false);
  }

  async function saveOrder() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/pages/homepage/product-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: items.map((i) => i.id) }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save order");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error while saving order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Move products with the arrows, then click Save order. New uploads appear at the bottom until
          you place them.
        </p>
        <Button size="sm" disabled={busy || !items.length} onClick={() => void saveOrder()}>
          {busy ? "Saving..." : "Save order"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-muted-foreground">Order saved. Homepage will use this sequence.</p> : null}
      {items.map((product, index) => (
        <div
          key={product.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
        >
          <span className="w-7 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded border border-border bg-muted">
            {product.image ? (
              <Image
                src={product.image}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
                unoptimized={shouldBypassImageOptimization(product.image)}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              /{product.slug}
              {product.isBestSeller ? " · tagged best seller" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => move(index, -1)}
              disabled={index === 0 || busy}
              aria-label={`Move ${product.name} up`}
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => move(index, 1)}
              disabled={index === items.length - 1 || busy}
              aria-label={`Move ${product.name} down`}
            >
              ↓
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products with variants to show on the homepage yet.</p>
      ) : null}
    </div>
  );
}
