"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OCCASION_CARDS_LIMIT,
  defaultShopOccasionItem,
  editorInitialOccasionCards,
  presetKeyFromRowId,
  presetShellStarterCards,
  type OccasionSectionCardStored,
  type ShopOccasionKey,
} from "@/lib/home/shop-by-occasion";

const BUCKET = "product-images";

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "image";
}

function previewForRow(row: OccasionSectionCardStored) {
  const base = row.preset_key ? defaultShopOccasionItem(row.preset_key) : null;
  const titleRaw = (row.title ?? "").trim();
  const hrefRaw = (row.href ?? "").trim();
  const imageRaw = (row.image_url ?? "").trim();
  const altRaw = (row.alt ?? "").trim();

  if (base) {
    return {
      title: titleRaw || base.title,
      href: hrefRaw || base.href,
      image: imageRaw || base.image,
      alt: altRaw || base.alt,
    };
  }
  return {
    title: titleRaw || "New collection",
    href: hrefRaw || "/shop",
    image:
      imageRaw ||
      "data:image/svg+xml," +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="533"><rect fill="#e5e5e5" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#737373" font-family="system-ui" font-size="14">Add image</text></svg>'),
    alt: altRaw || "Collection",
  };
}

function newCustomCard(): OccasionSectionCardStored {
  return {
    id: crypto.randomUUID(),
    title: "New collection",
    href: "/shop",
    image_url: "",
    alt: "",
    image_class_name: "",
  };
}

export function ShopByOccasionEditor({ initialSections }: { initialSections: Record<string, unknown> }) {
  const initialCards = React.useMemo(() => editorInitialOccasionCards(initialSections), [initialSections]);

  const router = useRouter();
  const [rows, setRows] = React.useState<OccasionSectionCardStored[]>(initialCards);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(editorInitialOccasionCards(initialSections));
  }, [initialSections]);

  function patchRow(id: string, patch: Partial<OccasionSectionCardStored>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function moveRow(id: string, delta: -1 | 1) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function uploadForId(id: string, file: File | null) {
    if (!file || !file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `occasions/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (data?.publicUrl) patchRow(id, { image_url: data.publicUrl });
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function resetPresetOverrides(id: string, key: ShopOccasionKey) {
    patchRow(id, {
      preset_key: key,
      title: undefined,
      href: undefined,
      image_url: undefined,
      alt: undefined,
      image_class_name: undefined,
    });
  }

  async function saveAll() {
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const payload = rows.map((r) => ({
        id: r.id,
        ...(r.preset_key ? { preset_key: r.preset_key } : {}),
        title: (r.title ?? "").trim(),
        href: (r.href ?? "").trim(),
        image_url: (r.image_url ?? "").trim(),
        alt: (r.alt ?? "").trim(),
        image_class_name: (r.image_class_name ?? "").trim(),
      }));
      const res = await fetch("/api/admin/homepage/shop-by-occasion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: payload }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save");
        return;
      }
      setOk(`Saved ${rows.length} card${rows.length === 1 ? "" : "s"}.`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const canAdd = rows.length < OCCASION_CARDS_LIMIT;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Add custom collection cards or edit the four presets. Order on this page is the order on the homepage. Stored in{" "}
        <span className="font-mono text-foreground">home_content.sections.shop_by_occasion.cards</span>.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !canAdd}
          onClick={() => setRows((prev) => [...prev, newCustomCard()])}
        >
          Add collection card
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setRows(presetShellStarterCards())}
        >
          Restore four preset slots
        </Button>
        {!canAdd ? (
          <span className="text-xs text-muted-foreground">Maximum {OCCASION_CARDS_LIMIT} cards.</span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-600">{ok}</p> : null}

      <div className="grid gap-6">
        {rows.map((row, idx) => {
          const presetLabel = row.preset_key ?? presetKeyFromRowId(row.id);
          const isPreset = Boolean(row.preset_key ?? presetKeyFromRowId(row.id));
          const pk = (row.preset_key ?? presetKeyFromRowId(row.id)) as ShopOccasionKey | undefined;
          const defaults = pk ? defaultShopOccasionItem(pk) : null;
          const preview = previewForRow(row);
          const isDataPreview = preview.image.startsWith("data:image/");

          return (
            <div
              key={row.id}
              className="rounded-[var(--radius-lg)] border border-border bg-background p-4 md:grid md:grid-cols-[minmax(0,200px)_1fr] md:gap-6 md:p-5"
            >
              <div className="relative mb-4 aspect-[3/4] w-full max-w-[200px] overflow-hidden border border-border bg-muted md:mb-0">
                <Image
                  src={preview.image}
                  alt={preview.alt}
                  fill
                  unoptimized={isDataPreview}
                  className="object-cover"
                  sizes="200px"
                />
              </div>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {isPreset ? "Preset slot" : "Custom"}
                    </span>
                    {presetLabel ? (
                      <span className="text-xs capitalize text-muted-foreground">{presetLabel}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" variant="outline" size="sm" disabled={busy || idx === 0} onClick={() => moveRow(row.id, -1)}>
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || idx >= rows.length - 1}
                      onClick={() => moveRow(row.id, 1)}
                    >
                      ↓
                    </Button>
                    {pk ? (
                      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => resetPresetOverrides(row.id, pk)}>
                        Reset preset
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}>
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`title-${row.id}`}>{pk ? "Title (optional)" : "Title"}</Label>
                    <Input
                      id={`title-${row.id}`}
                      value={row.title ?? ""}
                      onChange={(e) => patchRow(row.id, { title: e.target.value })}
                      placeholder={defaults?.title ?? "Collection name"}
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`href-${row.id}`}>{pk ? "Link (optional)" : "Link"}</Label>
                    <Input
                      id={`href-${row.id}`}
                      value={row.href ?? ""}
                      onChange={(e) => patchRow(row.id, { href: e.target.value })}
                      placeholder={defaults?.href ?? "https://… or /shop"}
                      disabled={busy}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`alt-${row.id}`}>Image alt text</Label>
                  <Input
                    id={`alt-${row.id}`}
                    value={row.alt ?? ""}
                    onChange={(e) => patchRow(row.id, { alt: e.target.value })}
                    placeholder={defaults?.alt ?? ""}
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`image-${row.id}`}>{pk ? "Image URL (optional)" : "Image URL"}</Label>
                  <Input
                    id={`image-${row.id}`}
                    value={row.image_url ?? ""}
                    onChange={(e) => patchRow(row.id, { image_url: e.target.value })}
                    placeholder={defaults ? "Uses preset image when empty" : "Required before save"}
                    disabled={busy}
                    className="font-mono text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      id={`occasion-upload-${row.id}`}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        if (f) uploadForId(row.id, f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => document.getElementById(`occasion-upload-${row.id}`)?.click()}
                    >
                      Upload image
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`cls-${row.id}`}>Custom image crop (Tailwind)</Label>
                  <Input
                    id={`cls-${row.id}`}
                    value={row.image_class_name ?? ""}
                    onChange={(e) => patchRow(row.id, { image_class_name: e.target.value })}
                    placeholder={defaults?.imageClassName ?? "Optional"}
                    disabled={busy}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          No cards configured — the storefront will show the four built-in presets until you save a list here.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="button" onClick={saveAll} disabled={busy}>
          {busy ? "Saving..." : "Save collection cards"}
        </Button>
      </div>
    </div>
  );
}
