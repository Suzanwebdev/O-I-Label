"use client";

import * as React from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BUCKET = "product-images";

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "image";
}

export function StoreHeroImageUpload({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onFile(file: File | null) {
    if (!file || disabled) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `store-control/${Date.now()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (data?.publicUrl) onChange(data.publicUrl);
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
      <Label className="text-sm font-medium">{label}</Label>
      {value ? (
        <div className="relative aspect-[16/10] w-full max-w-xs overflow-hidden rounded-lg border border-border bg-muted">
          <Image src={value} alt="" fill className="object-cover" sizes="320px" />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
            Remove
          </Button>
        ) : null}
      </div>
      <Input
        placeholder="Or paste image URL"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.trim() || null)}
      />
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
