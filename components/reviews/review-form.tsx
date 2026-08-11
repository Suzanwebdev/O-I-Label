"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { StarRatingInput } from "@/components/reviews/star-rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatPurchasedVariantLine, REVIEW_MAX_PHOTOS } from "@/lib/reviews/types";
import type { EligibleReviewItem } from "@/lib/reviews/types";

type Uploaded = { storage_path: string; public_url: string; previewUrl: string };

function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
      >
        {children}
      </label>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground/90">{hint}</p> : null}
    </div>
  );
}

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
  const fileRef = React.useRef<HTMLInputElement>(null);

  const selected = openItems.find((i) => i.order_item_id === orderItemId) ?? openItems[0];
  const variant = selected
    ? formatPurchasedVariantLine(selected.purchased_color, selected.purchased_size)
    : null;

  if (openItems.length === 0) {
    return (
      <div className="max-w-xl border-t border-border pt-8">
        {eligibleItems.some((i) => i.already_reviewed) ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            You’ve already reviewed your purchase of this piece. Thank you.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Only verified purchases can leave a review.{" "}
            <Link href="/account/orders" className="text-foreground underline underline-offset-4">
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
    if (fileRef.current) fileRef.current.value = "";
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
      <div className="max-w-xl border-t border-border pt-8">
        <p className="font-serif-display text-xl font-semibold tracking-tight text-foreground">
          Thank you for your review.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          It’s pending moderation and will appear once approved.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-xl space-y-8 border-t border-border pt-8 md:mx-0"
      noValidate={false}
    >
      <header className="space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Share your experience
        </p>
        <div>
          <h3 className="font-serif-display text-xl font-semibold leading-snug tracking-tight text-foreground md:text-[1.35rem]">
            {selected.product_name}
          </h3>
          {variant ? (
            <p className="mt-1.5 text-sm tracking-wide text-muted-foreground">{variant}</p>
          ) : null}
        </div>
      </header>

      {openItems.length > 1 ? (
        <fieldset className="space-y-3">
          <legend className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Which purchase?
          </legend>
          <div className="space-y-2">
            {openItems.map((item) => {
              const line = formatPurchasedVariantLine(item.purchased_color, item.purchased_size);
              const active = item.order_item_id === (selected?.order_item_id ?? orderItemId);
              return (
                <button
                  key={item.order_item_id}
                  type="button"
                  onClick={() => setOrderItemId(item.order_item_id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2",
                    active
                      ? "border-foreground bg-foreground/[0.03]"
                      : "border-border hover:border-foreground/40"
                  )}
                  aria-pressed={active}
                >
                  <span className="text-sm font-medium text-foreground">{item.product_name}</span>
                  {line ? (
                    <span className="text-xs text-muted-foreground">{line}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Your purchase</span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="space-y-3">
        <FieldLabel>Rating</FieldLabel>
        <StarRatingInput value={rating} onChange={setRating} disabled={busy} />
      </div>

      <div className="space-y-2.5">
        <FieldLabel htmlFor="review-title">Review title</FieldLabel>
        <Input
          id="review-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short headline"
          disabled={busy}
          className="h-12 border-border/80 bg-transparent"
        />
      </div>

      <div className="space-y-2.5">
        <FieldLabel htmlFor="review-body">Your review</FieldLabel>
        <Textarea
          id="review-body"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell us about the fit, quality, material and your overall experience."
          disabled={busy}
          className="min-h-[9.5rem] resize-y border-border/80 bg-transparent leading-relaxed"
        />
      </div>

      <div className="space-y-2.5">
        <FieldLabel htmlFor="review-name" hint="How you’d like your name displayed">
          Your name
        </FieldLabel>
        <Input
          id="review-name"
          value={displayName}
          maxLength={60}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          disabled={busy}
          className="h-12 border-border/80 bg-transparent"
        />
      </div>

      <div className="space-y-3">
        <FieldLabel hint="Share photos of your O & I piece.">
          Add photos · Optional
        </FieldLabel>

        <input
          ref={fileRef}
          id="review-photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          disabled={busy || photos.length >= REVIEW_MAX_PHOTOS}
          onChange={(e) => void onFiles(e.target.files)}
        />

        {photos.length < REVIEW_MAX_PHOTOS ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border px-5 text-sm text-muted-foreground transition-colors",
              "hover:border-foreground/50 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <span aria-hidden className="text-base leading-none">
              +
            </span>
            Add photos
          </button>
        ) : null}

        {photos.length ? (
          <ul className="flex flex-wrap gap-2.5 pt-1">
            {photos.map((p) => (
              <li
                key={p.storage_path}
                className="group relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-[var(--radius-sm)] border border-border"
              >
                <Image src={p.previewUrl} alt="" fill className="object-cover" unoptimized />
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 to-transparent pb-1.5 text-[10px] font-medium uppercase tracking-wider text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((x) => x.storage_path !== p.storage_path))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Up to {REVIEW_MAX_PHOTOS} photos · JPEG, PNG, WebP or GIF
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="pt-1">
        <Button
          type="submit"
          variant="navy"
          size="lg"
          disabled={busy || !body.trim()}
          className="w-full uppercase tracking-[0.12em] sm:w-auto sm:min-w-[12rem]"
        >
          {busy ? "Submitting…" : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
