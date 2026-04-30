"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BUCKET = "product-images";

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "image";
}

export function CategoryRowActions({
  categoryId,
  initialName,
  initialImageUrl,
}: {
  categoryId: string;
  initialName: string;
  initialImageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState(initialName);
  const [imageUrl, setImageUrl] = React.useState(initialImageUrl ?? "");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function uploadImage(file: File) {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `categories/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (data?.publicUrl) {
        setImageUrl(data.publicUrl);
        setSelectedFile(null);
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onPickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported.");
      return;
    }
    setError(null);
    setSelectedFile(file);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, name, imageUrl }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save category");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this category?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not delete category");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-44" disabled={busy} />
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="h-8 w-72"
          placeholder="Category image URL"
          disabled={busy}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            onPickFile(file ?? null);
          }}
        />
        <Button size="sm" type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          Choose image
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={busy || !selectedFile}
          onClick={() => (selectedFile ? void uploadImage(selectedFile) : undefined)}
        >
          {busy ? "Uploading..." : "Upload selected"}
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={busy || (!selectedFile && !previewUrl)}
          onClick={() => {
            setSelectedFile(null);
            if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Clear preview
        </Button>
        <Button size="sm" type="button" disabled={busy} onClick={() => void save()}>
          Save
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          disabled={busy}
          onClick={() => void remove()}
        >
          Delete
        </Button>
      </div>
      {previewUrl || imageUrl ? (
        <div className="h-14 w-14 overflow-hidden rounded-full border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl ?? imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
