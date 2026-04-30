"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductMediaSection } from "@/components/admin/product-media-section";
import type { OccasionTag, ProductBadge } from "@/lib/types";

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
const OCCASION_OPTIONS: OccasionTag[] = ["birthday", "vacation", "wedding", "corporate"];

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

function parseTokenList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

function variantIdentity(color: string, size: string) {
  return `${color.trim().toLowerCase()}::${size.trim().toLowerCase()}`;
}

function isBlankVariant(v: VariantDraft) {
  return (
    v.size.trim() === "" &&
    v.color.trim() === "" &&
    v.sku.trim() === "" &&
    v.price.trim() === "" &&
    v.compareAt.trim() === "" &&
    (v.stock.trim() === "" || v.stock.trim() === "0")
  );
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
  const [occasions, setOccasions] = React.useState<OccasionTag[]>([]);
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [videoUrls, setVideoUrls] = React.useState<string[]>([]);
  const [variants, setVariants] = React.useState<VariantDraft[]>([emptyVariant()]);
  const [bulkColorsInput, setBulkColorsInput] = React.useState("");
  const [bulkSizesInput, setBulkSizesInput] = React.useState("XS, S, M, L, XL");
  const [bulkBasePrice, setBulkBasePrice] = React.useState("");
  const [bulkBaseStock, setBulkBaseStock] = React.useState("0");
  const [bulkCompareAt, setBulkCompareAt] = React.useState("");
  const [bulkSkuPrefix, setBulkSkuPrefix] = React.useState("");
  const [bulkMessage, setBulkMessage] = React.useState<string | null>(null);
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

  function toggleOccasion(occasion: OccasionTag) {
    setOccasions((prev) => (prev.includes(occasion) ? prev.filter((o) => o !== occasion) : [...prev, occasion]));
  }

  function generateBulkVariants() {
    setBulkMessage(null);
    const colors = parseTokenList(bulkColorsInput);
    const sizes = parseTokenList(bulkSizesInput);
    if (colors.length === 0 || sizes.length === 0) {
      setBulkMessage("Add at least one colour and one size to generate variants.");
      return;
    }

    const skuBase = toSlug(bulkSkuPrefix || slug || name || "product");
    let skipped = 0;
    const nextRows: VariantDraft[] = [];
    const existingKeys = new Set(variants.map((v) => variantIdentity(v.color, v.size)));

    for (const color of colors) {
      for (const size of sizes) {
        const key = variantIdentity(color, size);
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        existingKeys.add(key);
        const colorCode = toSlug(color).replace(/-/g, "").slice(0, 8) || "base";
        const sizeCode = toSlug(size).replace(/-/g, "").slice(0, 8) || "one";
        nextRows.push({
          color,
          size,
          sku: `${skuBase}-${colorCode}-${sizeCode}`,
          price: bulkBasePrice.trim(),
          compareAt: bulkCompareAt.trim(),
          stock: bulkBaseStock.trim() || "0",
        });
      }
    }

    if (nextRows.length === 0) {
      setBulkMessage(skipped > 0 ? "No new rows added — all generated combinations already exist." : "No variants generated.");
      return;
    }

    setVariants((prev) => {
      if (prev.length === 1 && isBlankVariant(prev[0])) return nextRows;
      return [...prev, ...nextRows];
    });
    setBulkMessage(
      skipped > 0
        ? `Added ${nextRows.length} variants, skipped ${skipped} duplicate combination${skipped === 1 ? "" : "s"}.`
        : `Added ${nextRows.length} variants.`
    );
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
          occasions,
          categoryId,
          imagePaths: imageUrls,
          videoUrls,
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
    <form onSubmit={onSubmit} className="space-y-8">
      <section
        aria-labelledby="product-basics-heading"
        className="space-y-4 rounded-[var(--radius-lg)] border-2 border-black/10 bg-white p-4 shadow-sm md:p-6"
      >
        <div className="border-l-4 border-black pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step 1</p>
          <h2 id="product-basics-heading" className="font-serif-display text-xl font-semibold tracking-tight text-black">
            Basics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Name, URL slug, category, and the story shoppers read on the product page.</p>
        </div>
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
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            placeholder="Fabric, fit, care, styling notes — everything a customer should know."
            className="min-h-[120px]"
          />
        </div>
      </section>

      <ProductMediaSection
        imageUrls={imageUrls}
        onImageUrlsChange={setImageUrls}
        videoUrls={videoUrls}
        onVideoUrlsChange={setVideoUrls}
        disabled={busy}
      />

      <div
        id="variants"
        className="space-y-4 rounded-[var(--radius-lg)] border-2 border-black/10 bg-neutral-50/80 p-4 md:p-6"
      >
        <div className="border-l-4 border-black pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step 3</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-serif-display text-xl font-semibold tracking-tight text-black">Sizes, colours & variants</h2>
            <p className="text-sm text-muted-foreground">
              Each row is one sellable SKU (e.g. <span className="font-medium text-foreground">Black / M</span>). Add a row per
              size and colour combination. Stock is tracked per variant.
            </p>
          </div>
          <Button type="button" size="sm" variant="default" onClick={addVariant} disabled={busy} className="shrink-0">
            + Add another variant
          </Button>
        </div>
        </div>

        <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-white p-3 md:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-black">Bulk variant generator (optional)</h3>
              <p className="text-xs text-muted-foreground">
                Create many size/colour rows at once. Your existing manual rows stay unchanged.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={generateBulkVariants}>
              Generate variants
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bulkColors">Colours (comma or new line)</Label>
              <Textarea
                id="bulkColors"
                value={bulkColorsInput}
                onChange={(e) => setBulkColorsInput(e.target.value)}
                disabled={busy}
                className="min-h-[88px]"
                placeholder="Black, White, Olive, Burgundy"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={busy}
                onClick={() => setBulkColorsInput(COMMON_COLORS.join(", "))}
              >
                Use common colour list
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulkSizes">Sizes (comma or new line)</Label>
              <Textarea
                id="bulkSizes"
                value={bulkSizesInput}
                onChange={(e) => setBulkSizesInput(e.target.value)}
                disabled={busy}
                className="min-h-[88px]"
                placeholder="XS, S, M, L, XL"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={busy}
                onClick={() => setBulkSizesInput(COMMON_SIZES.join(", "))}
              >
                Use full size preset
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="bulkBasePrice">Default price (GHc)</Label>
              <Input
                id="bulkBasePrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={bulkBasePrice}
                onChange={(e) => setBulkBasePrice(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulkBaseStock">Default stock</Label>
              <Input
                id="bulkBaseStock"
                type="number"
                min="0"
                step="1"
                value={bulkBaseStock}
                onChange={(e) => setBulkBaseStock(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulkCompareAt">Default compare-at</Label>
              <Input
                id="bulkCompareAt"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={bulkCompareAt}
                onChange={(e) => setBulkCompareAt(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulkSkuPrefix">SKU prefix (optional)</Label>
              <Input
                id="bulkSkuPrefix"
                value={bulkSkuPrefix}
                onChange={(e) => setBulkSkuPrefix(e.target.value)}
                disabled={busy}
                placeholder="e.g. basic-top"
              />
            </div>
          </div>
          {bulkMessage ? <p className="text-xs text-muted-foreground">{bulkMessage}</p> : null}
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

      <section
        aria-labelledby="product-visibility-heading"
        className="space-y-4 rounded-[var(--radius-lg)] border-2 border-black/10 bg-white p-4 shadow-sm md:p-6"
      >
        <div className="border-l-4 border-black pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step 4</p>
          <h2 id="product-visibility-heading" className="font-serif-display text-xl font-semibold tracking-tight text-black">
            Visibility & merchandising
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft products stay hidden from the shop. Badges highlight promos; SEO fields help search results.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="block">Status</Label>
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-neutral-50/50 px-3 py-2">
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} disabled={busy} />
              <Label htmlFor="isActive" className="text-sm">
                {isActive ? "Active (visible when category allows)" : "Draft (not sold)"}
              </Label>
            </div>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="seoDescription">SEO description (optional)</Label>
          <Textarea
            id="seoDescription"
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            disabled={busy}
            className="min-h-[88px]"
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
        <div className="space-y-2">
          <Label>Shop by occasion tags</Label>
          <p className="text-xs text-muted-foreground">
            These power the homepage &quot;Shop by occasion&quot; cards and `/shop?occasion=...` filtering.
          </p>
          <div className="flex flex-wrap gap-2">
            {OCCASION_OPTIONS.map((occasion) => (
              <button
                key={occasion}
                type="button"
                onClick={() => toggleOccasion(occasion)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                  occasions.includes(occasion)
                    ? "border-black bg-neutral-100 text-black"
                    : "border-border text-muted-foreground hover:border-black/30"
                }`}
                disabled={busy}
              >
                {occasion}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="product-review-heading"
        className="space-y-4 rounded-[var(--radius-lg)] border-2 border-black bg-black p-4 text-white md:p-6"
      >
        <div className="border-l-4 border-white pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">Step 5</p>
          <h2 id="product-review-heading" className="font-serif-display text-xl font-semibold tracking-tight">
            Review & publish
          </h2>
          <p className="mt-1 text-sm text-white/90">Confirm totals before creating — you can edit the product later.</p>
        </div>
        <div className="grid gap-4 rounded-[var(--radius-md)] border border-white/25 bg-black/20 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-white/70">Total variants</Label>
            <Input
              className="border-white/30 bg-white/10 text-white"
              value={String(variants.length)}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Total stock</Label>
            <Input
              className="border-white/30 bg-white/10 text-white"
              value={String(
                variants.reduce((sum, v) => sum + (Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0), 0)
              )}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Base currency</Label>
            <Input className="border-white/30 bg-white/10 text-white" value="GHc" disabled />
          </div>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || categories.length === 0} className="bg-white text-black hover:bg-neutral-200">
              {busy ? "Creating..." : "Create product"}
            </Button>
            {categories.length === 0 ? (
              <p className="text-xs text-white/80">Create a category first before adding products.</p>
            ) : null}
          </div>
          <p className="text-xs text-white/70">
            {imageUrls.length} image{imageUrls.length === 1 ? "" : "s"} · {videoUrls.length} video link
            {videoUrls.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>
    </form>
  );
}

