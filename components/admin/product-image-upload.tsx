"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VERSIONED_PUBLIC_IMAGE_CACHE_CONTROL } from "@/lib/media/image-cache";
import { optimizeProductImageForUpload } from "@/lib/media/optimize-product-image";
import { decideUncommittedImageRemove } from "@/lib/media/uncommitted-product-image";

const BUCKET = "product-images";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

export function ProductImageUploadSection({
  urls,
  onUrlsChange,
  disabled,
}: {
  urls: string[];
  onUrlsChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const [manualText, setManualText] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [removingIndex, setRemovingIndex] = React.useState<number | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadNote, setUploadNote] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const uncommittedUrls = React.useRef(new Set<string>());

  async function onFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    setUploadError(null);
    setUploadNote(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const nextUrls = [...urls];
      let optimizedCount = 0;
      for (const file of Array.from(files)) {
        const prepared = await optimizeProductImageForUpload(file);
        if (!prepared.ok) {
          setUploadError(prepared.error);
          continue;
        }
        const path = `catalog/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${prepared.fileName}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, prepared.blob, {
          cacheControl: VERSIONED_PUBLIC_IMAGE_CACHE_CONTROL,
          upsert: false,
          contentType: prepared.blob.type || "image/webp",
        });
        if (error) {
          setUploadError("That photo could not be uploaded. Please try again.");
          continue;
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
          uncommittedUrls.current.add(data.publicUrl);
          nextUrls.push(data.publicUrl);
          optimizedCount += 1;
        }
      }
      onUrlsChange(nextUrls);
      if (optimizedCount > 0) {
        setUploadNote("Image optimized for web");
      }
    } catch {
      setUploadError("Upload failed. Check you are signed in as an admin.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function addManualUrls() {
    const lines = manualText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    onUrlsChange([...urls, ...lines]);
    setManualText("");
  }

  async function removeAt(index: number) {
    if (disabled || removingIndex != null) return;
    const url = urls[index];
    if (!url) return;
    const remaining = urls.filter((_, idx) => idx !== index);
    const decision = decideUncommittedImageRemove({
      url,
      uncommittedUrls: uncommittedUrls.current,
      remainingUrls: remaining,
      supabaseUrl: SUPABASE_URL,
    });

    if (decision.action === "ui-only") {
      onUrlsChange(remaining);
      return;
    }

    if (decision.action === "refuse") {
      setUploadNote(null);
      setUploadError(decision.error);
      return;
    }

    setUploadError(null);
    setRemovingIndex(index);
    try {
      const res = await fetch("/api/admin/products/uncommitted-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setUploadError(json.error ?? "The new upload could not be deleted from storage. Please try again.");
        return;
      }
      uncommittedUrls.current.delete(url);
      onUrlsChange(remaining);
    } catch {
      setUploadError("The new upload could not be deleted from storage. Please try again.");
    } finally {
      setRemovingIndex(null);
    }
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-muted/30 p-4">
      <div>
        <Label className="text-base font-semibold">Product images</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload photos from your device (saved to Supabase), or paste image URLs — one per line.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={disabled || uploading || removingIndex != null}
          onChange={(e) => void onFiles(e.target.files)}
        />
        <Button type="button" variant="secondary" disabled={disabled || uploading || removingIndex != null} onClick={() => inputRef.current?.click()}>
          {uploading ? "Uploading…" : "Choose images to upload"}
        </Button>
        <span className="text-xs text-muted-foreground">JPEG / PNG / WebP · max 10 MB</span>
      </div>

      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
      {uploadNote ? <p className="text-sm text-muted-foreground">{uploadNote}</p> : null}

      {urls.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {urls.map((url, i) => (
            <li key={`${url}-${i}`} className="w-24 space-y-1">
              <div className="aspect-[3/4] overflow-hidden rounded-md border border-border bg-background">
                {/* Admin-only previews; URLs may be any host (paste + Supabase). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 w-full px-1 text-xs"
                disabled={disabled || removingIndex != null}
                onClick={() => void removeAt(i)}
              >
                {removingIndex === i ? "Removing…" : "Remove"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No images yet — shoppers will see a placeholder until you add some.</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="manual-image-urls">Paste image URLs (optional)</Label>
        <Textarea
          id="manual-image-urls"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          disabled={disabled}
          className="min-h-[72px] font-mono text-xs"
          placeholder="https://…&#10;https://…"
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || !manualText.trim()} onClick={addManualUrls}>
          Add pasted URLs
        </Button>
      </div>
    </div>
  );
}
