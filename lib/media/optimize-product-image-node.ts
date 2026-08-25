/**
 * Node-only catalog image optimization for local migration scripts.
 * Mirrors Phase 2 browser rules (long edge ≤ 2000, WebP q0.86, JPEG fallback).
 * Do not import from Next.js app routes or client components.
 */

import sharp from "sharp";
import {
  PRODUCT_IMAGE_ALLOWED_MIME,
  PRODUCT_IMAGE_MAX_SOURCE_BYTES,
  PRODUCT_IMAGE_OUTPUT_QUALITY,
  catalogImageFileName,
  catalogImageOutputSize,
} from "./optimize-product-image";

export type OptimizeProductImageNodeSuccess = {
  ok: true;
  buffer: Buffer;
  mime: string;
  fileName: string;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  resized: boolean;
};

export type OptimizeProductImageNodeFailure = {
  ok: false;
  error: string;
};

export type OptimizeProductImageNodeResult =
  | OptimizeProductImageNodeSuccess
  | OptimizeProductImageNodeFailure;

const SHARP_QUALITY = Math.round(PRODUCT_IMAGE_OUTPUT_QUALITY * 100);

const SHARP_FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function sharpFormatToMime(format: string | undefined): string | null {
  if (!format) return null;
  return SHARP_FORMAT_TO_MIME[format.toLowerCase()] ?? null;
}

export function isAllowedProductImageMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return PRODUCT_IMAGE_ALLOWED_MIME.has(mime);
}

export function validateProductImageBufferSize(size: number): string | null {
  if (size > PRODUCT_IMAGE_MAX_SOURCE_BYTES) {
    return "That photo is larger than 10 MB. Please choose a smaller file.";
  }
  if (size <= 0) {
    return "That file could not be read as an image.";
  }
  return null;
}

function mimeFromSharpFormat(format: string | undefined): string | null {
  return sharpFormatToMime(format);
}

/**
 * Resize (long edge ≤ 2000, never upscale) and encode as WebP, with JPEG fallback.
 * Does not write to Storage.
 */
export async function optimizeProductImageBuffer(
  input: Buffer,
  options?: { sourceMime?: string | null; originalFileName?: string }
): Promise<OptimizeProductImageNodeResult> {
  const sizeError = validateProductImageBufferSize(input.length);
  if (sizeError) return { ok: false, error: sizeError };

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    return { ok: false, error: "That file could not be read as an image." };
  }

  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  if (sourceWidth < 1 || sourceHeight < 1) {
    return { ok: false, error: "That file could not be read as an image." };
  }

  const detectedMime = mimeFromSharpFormat(meta.format);
  const sourceMime = options?.sourceMime?.trim() || detectedMime;
  if (!isAllowedProductImageMime(sourceMime)) {
    return { ok: false, error: "Please upload a JPEG, PNG, or WebP image." };
  }

  const { width: outputWidth, height: outputHeight, resized } = catalogImageOutputSize(
    sourceWidth,
    sourceHeight
  );

  let pipeline = sharp(input, { failOn: "none" }).rotate();
  if (resized) {
    pipeline = pipeline.resize(outputWidth, outputHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let buffer: Buffer;
  let mime = "image/webp";
  try {
    buffer = await pipeline.clone().webp({ quality: SHARP_QUALITY }).toBuffer();
  } catch {
    buffer = Buffer.alloc(0);
  }

  if (!buffer.length) {
    try {
      buffer = await pipeline.clone().jpeg({ quality: SHARP_QUALITY, mozjpeg: true }).toBuffer();
      mime = "image/jpeg";
    } catch {
      return { ok: false, error: "Could not optimize this image. Please try another file." };
    }
  }

  if (!buffer.length) {
    return { ok: false, error: "Could not optimize this image. Please try another file." };
  }

  const originalFileName = options?.originalFileName?.trim() || "image.jpg";
  return {
    ok: true,
    buffer,
    mime,
    fileName: catalogImageFileName(originalFileName, mime),
    sourceWidth,
    sourceHeight,
    outputWidth,
    outputHeight,
    resized,
  };
}
