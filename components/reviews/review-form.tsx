"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { StarRatingInput } from "@/components/reviews/star-rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPurchasedVariantLine, REVIEW_MAX_PHOTOS } from "@/lib/reviews/types";
import type { EligibleReviewItem } from "@/lib/reviews/types";

type Uploaded = { storage_path: string; public_url: string; previewUrl: string };

export function ReviewForm({
  productId,
  eligibleItems,
  defaultDisplayName,
}: {
  productId: string;
  eligibleItems: EligibleReviewItem[];
  defaultDisplayName: string;
}) {
  const openItems = eligibleItems.filter((i) => !i.already_reviewed);
  const [orderItemId, setOrderItemId] = React.useState(openItems[0]?.order_item_id ?? "");
  const [rating, setRating] = React.useState(5);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [displayName, setDisplayName] = React.useState(defaultDisplayName);
  const [photos, setPhotos] = React.useState<Uploaded[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const selected = openItems.find((i) => i.order_item_id === orderItemId) ?? openItems[0];
  const variant = selected
    ? formatPurchasedVariantLine(selected.purchased_color, selected.purchased_size)
    : null;

  if (openItems.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-5 text-sm text-muted-foreground">
        {eligibleItems.some((i) => i.already_reviewed) ? (
          <p>You’ve already reviewed your purchase of this piece. Thank you.</p>
        ) : (
          <p>
            Only verified purchases can leave a review.{" "}
            <Link href="/account/orders" className="text-navy underline underline-offset-2">
              View your orders
            </Link>
            .
          </p>
        )}
      </div>
    );
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (photos.length >= REVIEW_MAX_PHOTOS) break;
      const fd = new FormData();
      fd.set("file", file);
      fd.set("count", String(photos.length));
      const res = await fetch("/api/reviews/upload", { method: "POST", body: fd });
      const json = (await res.json()) as {
        error?: string;
        storage_path?: string;
        public_url?: string;
      };
      if (!res.ok || !json.storage_path || !json.public_url) {
        setError(json.error ?? "One or more photos could not be uploaded.");
        continue;
      }
      setPhotos((prev) => [
        ...prev,
        {
          storage_path: json.storage_path!,
          public_url: json.public_url!,
          previewUrl: URL.createObjectURL(file),
        },
      ]);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItemId: selected.order_item_id,
          productId,
          rating,
          title,
          body,
          displayName,
          media: photos.map(({ storage_path, public_url }) => ({ storage_path, public_url })),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Your review could not be submitted.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-5 text-sm">
        <p className="font-medium text-foreground">Thank you for your review.</p>
        <p className="mt-1 text-muted-foreground">
          It’s pending moderation and will appear once approved.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-[var(--radius-lg)] border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-6"
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Write a review
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Order {selected.order_number}
          {variant ? ` · ${variant}` : ""}
        </p>
      </div>

      {openItems.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="review-purchase">Purchase</Label>
          <select
            id="review-purchase"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={orderItemId}
            onChange={(e) => setOrderItemId(e.target.value)}
          >
            {openItems.map((i) => (
              <option key={i.order_item_id} value={i.order_item_id}>
                {i.order_number}
                {formatPurchasedVariantLine(i.purchased_color, i.purchased_size)
                  ? ` · ${formatPurchasedVariantLine(i.purchased_color, i.purchased_size)}`
                  : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Rating</Label>
        <StarRatingInput value={rating} onChange={setRating} disabled={busy} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input
          id="review-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short headline"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-body">Your review</Label>
        <textarea
          id="review-body"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell us about the fit, quality, material and your overall experience."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-name">Display name</Label>
        <Input
          id="review-name"
          value={displayName}
          maxLength={60}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How your name appears publicly"
        />
        <p className="text-xs text-muted-foreground">Your email and phone are never shown.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-photos">Photos (optional, up to {REVIEW_MAX_PHOTOS})</Label>
        <Input
          id="review-photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={busy || photos.length >= REVIEW_MAX_PHOTOS}
          onChange={(e) => void onFiles(e.target.files)}
        />
        {photos.length ? (
          <ul className="flex flex-wrap gap-2 pt-1">
            {photos.map((p) => (
              <li key={p.storage_path} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                <Image src={p.previewUrl} alt="" fill className="object-cover" unoptimized />
                <button
                  type="button"
                  className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[10px] text-white"
                  onClick={() => setPhotos((prev) => prev.filter((x) => x.storage_path !== p.storage_path))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        {busy ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
