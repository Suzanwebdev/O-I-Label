import {
  REVIEW_ALLOWED_MIME,
  REVIEW_MAX_BYTES,
  REVIEW_MAX_PHOTOS,
} from "@/lib/reviews/types";
import { createServiceRoleClient } from "@/lib/supabase/server";

const BUCKET = "review-photos";

export function validateReviewImageFile(file: File): string | null {
  if (!REVIEW_ALLOWED_MIME.has(file.type)) {
    return "Only JPEG, PNG, WebP, or GIF images are allowed.";
  }
  if (file.size > REVIEW_MAX_BYTES) {
    return "Each photo must be 5MB or smaller.";
  }
  return null;
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function uploadReviewPhoto(opts: {
  customerId: string;
  file: File;
}): Promise<{ storage_path: string; public_url: string } | { error: string }> {
  const invalid = validateReviewImageFile(opts.file);
  if (invalid) return { error: invalid };

  const service = createServiceRoleClient();
  const ext = extensionForMime(opts.file.type);
  const path = `${opts.customerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await opts.file.arrayBuffer());

  const { error } = await service.storage.from(BUCKET).upload(path, buffer, {
    contentType: opts.file.type,
    upsert: false,
  });
  if (error) {
    console.error("[reviews] upload:", error.message);
    return { error: "One or more photos could not be uploaded." };
  }

  const { data } = service.storage.from(BUCKET).getPublicUrl(path);
  return { storage_path: path, public_url: data.publicUrl };
}

export { REVIEW_MAX_PHOTOS, BUCKET as REVIEW_PHOTOS_BUCKET };
