"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CategoryOption = { id: string; name: string; slug: string };

export function ProductCreateForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [price, setPrice] = React.useState("");
  const [compareAt, setCompareAt] = React.useState("");
  const [stock, setStock] = React.useState("0");
  const [sku, setSku] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          categoryId,
          price,
          compareAt,
          stock,
          sku,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not create product");
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Product name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={busy} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (optional)</Label>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy} placeholder="auto-from-name" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          placeholder="Short product description"
          className="min-h-[100px]"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={busy || categories.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku">SKU (optional)</Label>
          <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} disabled={busy} placeholder="auto-generated" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="price">Price (GHc)</Label>
          <Input id="price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required disabled={busy} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compareAt">Compare-at (optional)</Label>
          <Input
            id="compareAt"
            type="number"
            min="0"
            step="0.01"
            value={compareAt}
            onChange={(e) => setCompareAt(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Initial stock</Label>
          <Input id="stock" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} required disabled={busy} />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy || categories.length === 0}>
          {busy ? "Creating..." : "Create product"}
        </Button>
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">Create a category first before adding products.</p>
        ) : null}
      </div>
    </form>
  );
}

