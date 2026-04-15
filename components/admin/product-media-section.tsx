"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductImageUploadSection } from "@/components/admin/product-image-upload";

function isValidVideoUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s.startsWith("https://")) return false;
  try {
    const u = new URL(s);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}

export function ProductMediaSection({
  imageUrls,
  onImageUrlsChange,
  videoUrls,
  onVideoUrlsChange,
  disabled,
}: {
  imageUrls: string[];
  onImageUrlsChange: (next: string[]) => void;
  videoUrls: string[];
  onVideoUrlsChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const [videoDraft, setVideoDraft] = React.useState("");
  const [videoError, setVideoError] = React.useState<string | null>(null);

  function addVideoUrl() {
    setVideoError(null);
    const v = videoDraft.trim();
    if (!v) return;
    if (!isValidVideoUrl(v)) {
      setVideoError("Use a full https:// link (YouTube, Vimeo, or hosted .mp4).");
      return;
    }
    if (videoUrls.includes(v)) {
      setVideoError("That URL is already added.");
      return;
    }
    if (videoUrls.length >= 8) {
      setVideoError("Maximum 8 video links per product.");
      return;
    }
    onVideoUrlsChange([...videoUrls, v]);
    setVideoDraft("");
  }

  return (
    <section
      aria-labelledby="product-media-heading"
      className="space-y-6 rounded-[var(--radius-lg)] border-2 border-black/10 bg-white p-4 shadow-sm md:p-6"
    >
      <div className="border-l-4 border-black pl-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step 2</p>
        <h2 id="product-media-heading" className="font-serif-display text-xl font-semibold tracking-tight text-black">
          Media
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gallery images for the shop (upload or paste URLs). Add optional video links for lookbooks or reels — host large
          files on YouTube or Vimeo, then paste the link here.
        </p>
      </div>

      <ProductImageUploadSection urls={imageUrls} onUrlsChange={onImageUrlsChange} disabled={disabled} />

      <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-muted/20 p-4">
        <Label className="text-base font-semibold">Video links (optional)</Label>
        <p className="text-sm text-muted-foreground">
          Up to 8 links. Shown on the product page when you wire the player; stored on the product for now.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="video-url-draft" className="text-xs text-muted-foreground">
              Paste video URL
            </Label>
            <Input
              id="video-url-draft"
              value={videoDraft}
              onChange={(e) => setVideoDraft(e.target.value)}
              disabled={disabled}
              placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addVideoUrl();
                }
              }}
            />
          </div>
          <Button type="button" variant="secondary" disabled={disabled || !videoDraft.trim()} onClick={addVideoUrl}>
            Add video
          </Button>
        </div>
        {videoError ? <p className="text-sm text-destructive">{videoError}</p> : null}
        {videoUrls.length > 0 ? (
          <ul className="space-y-2">
            {videoUrls.map((url, i) => (
              <li
                key={`${url}-${i}`}
                className="flex items-start justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs"
              >
                <span className="min-w-0 break-all font-mono text-muted-foreground">{url}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 text-destructive hover:text-destructive"
                  disabled={disabled}
                  onClick={() => onVideoUrlsChange(videoUrls.filter((_, idx) => idx !== i))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No videos added yet.</p>
        )}
      </div>
    </section>
  );
}
