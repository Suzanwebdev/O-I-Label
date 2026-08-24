/** Client-side catalog upload helpers. Dimension math is safe to unit-test in Node. */

export const PRODUCT_IMAGE_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_LONG_EDGE = 2000;
/** High fashion-photo quality: sharp, little banding, still much smaller than originals. */
export const PRODUCT_IMAGE_OUTPUT_QUALITY = 0.86;

export const PRODUCT_IMAGE_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateProductImageFile(file: Pick<File, "type" | "size">): string | null {
  if (!PRODUCT_IMAGE_ALLOWED_MIME.has(file.type)) {
    return "Please upload a JPEG, PNG, or WebP image.";
  }
  if (file.size > PRODUCT_IMAGE_MAX_SOURCE_BYTES) {
    return "That photo is larger than 10 MB. Please choose a smaller file.";
  }
  return null;
}

export function catalogImageOutputSize(
  width: number,
  height: number,
  maxLongEdge = PRODUCT_IMAGE_MAX_LONG_EDGE
): { width: number; height: number; resized: boolean } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const longEdge = Math.max(w, h);
  if (longEdge <= maxLongEdge) {
    return { width: w, height: h, resized: false };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    resized: true,
  };
}

export function catalogImageFileName(originalName: string, mime: string): string {
  const safe = originalName.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "image";
  const base = safe.replace(/\.[^.]+$/, "") || "image";
  if (mime === "image/webp") return `${base}.webp`;
  if (mime === "image/png") return `${base}.png`;
  return `${base}.jpg`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Resize (long edge ≤ 2000, never upscale) and encode as WebP, with JPEG fallback.
 * Browser-only. Does not write to Storage.
 */
export async function optimizeProductImageForUpload(file: File): Promise<
  { ok: true; blob: Blob; fileName: string } | { ok: false; error: string }
> {
  const invalid = validateProductImageFile(file);
  if (invalid) return { ok: false, error: invalid };

  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return { ok: false, error: "Image optimization is not available in this browser." };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: "That file could not be read as an image." };
  }

  try {
    const { width, height } = catalogImageOutputSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { ok: false, error: "Could not process this image. Please try another file." };
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, "image/webp", PRODUCT_IMAGE_OUTPUT_QUALITY);
    let mime = "image/webp";
    if (!blob || blob.size === 0) {
      blob = await canvasToBlob(canvas, "image/jpeg", PRODUCT_IMAGE_OUTPUT_QUALITY);
      mime = "image/jpeg";
    }
    if (!blob || blob.size === 0) {
      return { ok: false, error: "Could not optimize this image. Please try another file." };
    }

    return {
      ok: true,
      blob,
      fileName: catalogImageFileName(file.name, mime),
    };
  } finally {
    bitmap.close();
  }
}
