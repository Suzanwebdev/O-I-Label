"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const BUCKET = "product-images";

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "image";
}

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
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    setUploadError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const nextUrls = [...urls];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          setUploadError("Only image files are supported.");
          continue;
        }
        const path = `catalog/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeFileName(file.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) {
          setUploadError(error.message);
          continue;
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (data?.publicUrl) nextUrls.push(data.publicUrl);
      }
      onUrlsChange(nextUrls);
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
          accept="image/*"
          multiple
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => void onFiles(e.target.files)}
        />
        <Button type="button" variant="secondary" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? "Uploading…" : "Choose images to upload"}
        </Button>
        <span className="text-xs text-muted-foreground">JPEG / PNG / WebP</span>
      </div>

      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}

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
                disabled={disabled}
                onClick={() => onUrlsChange(urls.filter((_, idx) => idx !== i))}
              >
                Remove
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
