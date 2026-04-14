"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ProductImageUploadSection } from "@/components/admin/product-image-upload";
import type { ProductBadge } from "@/lib/types";

type CategoryOption = { id: string; name: string; slug: string };

type VariantDraft = {
  size: string;
  color: string;
  sku: string;
  price: string;
  compareAt: string;
  stock: string;
};

const BADGE_OPTIONS: ProductBadge[] = ["new", "best_seller", "limited", "sale", "selling_fast", "trending"];

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "One size"] as const;
const COMMON_COLORS = ["Black", "White", "Ivory", "Cream", "Navy", "Nude", "Espresso", "Burgundy", "Olive", "Blush"] as const;

function emptyVariant(): VariantDraft {
  return { size: "", color: "", sku: "", price: "", compareAt: "", stock: "0" };
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function ProductCreateForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [seoTitle, setSeoTitle] = React.useState("");
  const [seoDescription, setSeoDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [badges, setBadges] = React.useState<ProductBadge[]>([]);
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [variants, setVariants] = React.useState<VariantDraft[]>([emptyVariant()]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateVariant(idx: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
  }

  function removeVariant(idx: number) {
    setVariants((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function toggleBadge(badge: ProductBadge) {
    setBadges((prev) => (prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedVariants = variants.map((v) => ({
      size: v.size.trim() || null,
      color: v.color.trim() || null,
      sku: v.sku.trim(),
      price: Number(v.price),
      compareAt: v.compareAt.trim() === "" ? null : Number(v.compareAt),
      stock: Number(v.stock),
    }));
    const skuBase = toSlug(slug || name || "product");
    const resolvedVariants = normalizedVariants.map((v, idx) => ({
      ...v,
      sku: v.sku || `${skuBase}-${(v.color ?? "base").toLowerCase()}-${(v.size ?? idx + 1).toString().toLowerCase()}`,
    }));
    const validVariants =
      resolvedVariants.length > 0 &&
      resolvedVariants.every(
        (v) =>
          v.sku &&
          Number.isFinite(v.price) &&
          v.price > 0 &&
          (v.compareAt == null || (Number.isFinite(v.compareAt) && v.compareAt > 0)) &&
          Number.isFinite(v.stock) &&
          v.stock >= 0
      );
    if (!validVariants) {
      setError("Each variant needs SKU, price > 0, and stock >= 0.");
      return;
    }
    const skuSet = new Set(resolvedVariants.map((v) => v.sku.toLowerCase()));
    if (skuSet.size !== resolvedVariants.length) {
      setError("Variant SKUs must be unique within the product.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          seoTitle,
          seoDescription,
          isActive,
          badges,
          categoryId,
          imagePaths: imageUrls,
          variants: resolvedVariants,
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

      <ProductImageUploadSection urls={imageUrls} onUrlsChange={setImageUrls} disabled={busy} />

      <div id="variants" className="space-y-4 rounded-[var(--radius-lg)] border-2 border-border bg-muted/20 p-4 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-serif-display text-lg font-semibold tracking-tight">Sizes, colours & variants</h2>
            <p className="text-sm text-muted-foreground">
              Each row is one sellable SKU (e.g. <span className="font-medium text-foreground">Black / M</span>). Add a row per
              size and colour combination. Stock is tracked per variant.
            </p>
          </div>
          <Button type="button" size="sm" variant="default" onClick={addVariant} disabled={busy} className="shrink-0">
            + Add another variant
          </Button>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-2">#</th>
                <th className="pb-2 pr-2">Size</th>
                <th className="pb-2 pr-2">Colour</th>
                <th className="pb-2 pr-2">SKU</th>
                <th className="pb-2 pr-2">Price (GHc)</th>
                <th className="pb-2 pr-2">Compare-at</th>
                <th className="pb-2 pr-2">Stock</th>
                <th className="pb-2 w-10" />
              </tr>
            </thead>
            <tbody className="align-top">
              {variants.map((variant, idx) => {
                const sizeSelectValue = COMMON_SIZES.includes(variant.size as (typeof COMMON_SIZES)[number])
                  ? variant.size
                  : "custom";
                const colorSelectValue = COMMON_COLORS.includes(variant.color as (typeof COMMON_COLORS)[number])
                  ? variant.color
                  : "custom";
                return (
                  <tr key={`v-${idx}`} className="border-b border-border/80">
                    <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      <div className="space-y-1.5">
                        <Select
                          value={sizeSelectValue}
                          onValueChange={(v) => updateVariant(idx, { size: v === "custom" ? "" : v })}
                          disabled={busy}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Quick size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom size (type below)</SelectItem>
                            {COMMON_SIZES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="e.g. M, 38, Free size"
                          value={variant.size}
                          onChange={(e) => updateVariant(idx, { size: e.target.value })}
                          disabled={busy}
                          className="h-9"
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="space-y-1.5">
                        <Select
                          value={colorSelectValue}
                          onValueChange={(v) => updateVariant(idx, { color: v === "custom" ? "" : v })}
                          disabled={busy}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Quick colour" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom colour (type below)</SelectItem>
                            {COMMON_COLORS.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="e.g. Wine, Sand"
                          value={variant.color}
                          onChange={(e) => updateVariant(idx, { color: e.target.value })}
                          disabled={busy}
                          className="h-9"
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        placeholder="Auto if blank"
                        value={variant.sku}
                        onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                        disabled={busy}
                        className="h-9 font-mono text-xs"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={variant.price}
                        onChange={(e) => updateVariant(idx, { price: e.target.value })}
                        disabled={busy}
                        required
                        className="h-9"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="—"
                        value={variant.compareAt}
                        onChange={(e) => updateVariant(idx, { compareAt: e.target.value })}
                        disabled={busy}
                        className="h-9"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={variant.stock}
                        onChange={(e) => updateVariant(idx, { stock: e.target.value })}
                        disabled={busy}
                        required
                        className="h-9"
                      />
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9"
                        onClick={() => removeVariant(idx)}
                        disabled={busy || variants.length === 1}
                        aria-label="Remove variant"
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 md:hidden">
          {variants.map((variant, idx) => {
            const sizeSelectValue = COMMON_SIZES.includes(variant.size as (typeof COMMON_SIZES)[number])
              ? variant.size
              : "custom";
            const colorSelectValue = COMMON_COLORS.includes(variant.color as (typeof COMMON_COLORS)[number])
              ? variant.color
              : "custom";
            return (
              <div key={`vm-${idx}`} className="space-y-3 rounded-md border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Variant {idx + 1}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeVariant(idx)}
                    disabled={busy || variants.length === 1}
                  >
                    Remove
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Size</Label>
                  <Select
                    value={sizeSelectValue}
                    onValueChange={(v) => updateVariant(idx, { size: v === "custom" ? "" : v })}
                    disabled={busy}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom (type below)</SelectItem>
                      {COMMON_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Size value"
                    value={variant.size}
                    onChange={(e) => updateVariant(idx, { size: e.target.value })}
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Colour</Label>
                  <Select
                    value={colorSelectValue}
                    onValueChange={(v) => updateVariant(idx, { color: v === "custom" ? "" : v })}
                    disabled={busy}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom (type below)</SelectItem>
                      {COMMON_COLORS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Colour name"
                    value={variant.color}
                    onChange={(e) => updateVariant(idx, { color: e.target.value })}
                    disabled={busy}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Price (GHc)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.price}
                      onChange={(e) => updateVariant(idx, { price: e.target.value })}
                      disabled={busy}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Stock</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={variant.stock}
                      onChange={(e) => updateVariant(idx, { stock: e.target.value })}
                      disabled={busy}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">SKU</Label>
                    <Input
                      placeholder="Auto if blank"
                      value={variant.sku}
                      onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                      disabled={busy}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Compare-at</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.compareAt}
                      onChange={(e) => updateVariant(idx, { compareAt: e.target.value })}
                      disabled={busy}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
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
          <Label htmlFor="seoTitle">SEO title (optional)</Label>
          <Input
            id="seoTitle"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            disabled={busy}
            placeholder="Search engine title"
          />
        </div>
        <div className="space-y-2">
          <Label className="block">Status</Label>
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2">
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} disabled={busy} />
            <Label htmlFor="isActive" className="text-sm">
              {isActive ? "Active" : "Draft"}
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seoDescription">SEO description (optional)</Label>
        <Textarea
          id="seoDescription"
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          disabled={busy}
          className="min-h-[70px]"
          placeholder="Search engine description"
        />
      </div>

      <div className="space-y-2">
        <Label>Badges</Label>
        <div className="flex flex-wrap gap-2">
          {BADGE_OPTIONS.map((badge) => (
            <button
              key={badge}
              type="button"
              onClick={() => toggleBadge(badge)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                badges.includes(badge)
                  ? "border-black bg-neutral-100 text-black"
                  : "border-border text-muted-foreground hover:border-black/30"
              }`}
              disabled={busy}
            >
              {badge}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Total variants</Label>
          <Input value={String(variants.length)} disabled />
        </div>
        <div className="space-y-2">
          <Label>Total stock</Label>
          <Input
            value={String(
              variants.reduce((sum, v) => sum + (Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0), 0)
            )}
            disabled
          />
        </div>
        <div className="space-y-2">
          <Label>Base currency</Label>
          <Input value="GHc" disabled />
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

