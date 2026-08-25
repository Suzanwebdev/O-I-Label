import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  isAllowedProductImageMime,
  optimizeProductImageBuffer,
  sharpFormatToMime,
  validateProductImageBufferSize,
} from "../lib/media/optimize-product-image-node.ts";
import { parseCatalogObjectPath } from "../lib/media/catalog-storage-path.ts";
import { PRODUCT_IMAGE_MAX_LONG_EDGE, PRODUCT_IMAGE_MAX_SOURCE_BYTES } from "../lib/media/optimize-product-image.ts";

const ORIGIN = "https://example.supabase.co";

describe("optimize-product-image-node validation", () => {
  it("maps sharp formats to allowed MIME types", () => {
    assert.equal(sharpFormatToMime("jpeg"), "image/jpeg");
    assert.equal(sharpFormatToMime("png"), "image/png");
    assert.equal(sharpFormatToMime("webp"), "image/webp");
    assert.equal(sharpFormatToMime("gif"), null);
  });

  it("accepts jpeg, png, and webp MIME types", () => {
    assert.equal(isAllowedProductImageMime("image/jpeg"), true);
    assert.equal(isAllowedProductImageMime("image/png"), true);
    assert.equal(isAllowedProductImageMime("image/webp"), true);
    assert.equal(isAllowedProductImageMime("image/gif"), false);
  });

  it("rejects empty and oversized buffers", () => {
    assert.match(validateProductImageBufferSize(0) ?? "", /read as an image/i);
    assert.match(
      validateProductImageBufferSize(PRODUCT_IMAGE_MAX_SOURCE_BYTES + 1) ?? "",
      /10 MB/i
    );
  });
});

describe("optimizeProductImageBuffer", () => {
  it("scales a large PNG to a 2000px long edge and emits WebP", async () => {
    const source = await sharp({
      create: {
        width: 4000,
        height: 6000,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeProductImageBuffer(source, {
      sourceMime: "image/png",
      originalFileName: "Look 01.PNG",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.resized, true);
    assert.equal(result.outputHeight, PRODUCT_IMAGE_MAX_LONG_EDGE);
    assert.equal(result.outputWidth, 1333);
    assert.equal(result.mime, "image/webp");
    assert.match(result.fileName, /\.webp$/);
    assert.ok(result.buffer.length > 0);
    assert.ok(result.buffer.length < source.length);
  });

  it("leaves a small JPEG unchanged in dimensions but re-encodes", async () => {
    const source = await sharp({
      create: {
        width: 1200,
        height: 1800,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg({ quality: 95 })
      .toBuffer();

    const result = await optimizeProductImageBuffer(source, {
      sourceMime: "image/jpeg",
      originalFileName: "small.jpg",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.resized, false);
    assert.deepEqual(
      { width: result.outputWidth, height: result.outputHeight },
      { width: 1200, height: 1800 }
    );
    assert.ok(result.buffer.length > 0);
  });
});

describe("catalog path validation for migration", () => {
  it("accepts public catalog URLs for the configured Supabase origin", () => {
    const path = parseCatalogObjectPath(
      `${ORIGIN}/storage/v1/object/public/product-images/catalog/1710000000000-ab12cd34-Look_01.webp`,
      ORIGIN
    );
    assert.equal(path, "catalog/1710000000000-ab12cd34-Look_01.webp");
  });

  it("rejects traversal and non-catalog prefixes", () => {
    assert.equal(parseCatalogObjectPath("catalog/../secret.webp", ORIGIN), null);
    assert.equal(
      parseCatalogObjectPath(
        `${ORIGIN}/storage/v1/object/public/product-images/homepage/hero.webp`,
        ORIGIN
      ),
      null
    );
    assert.equal(parseCatalogObjectPath("https://evil.example/catalog/x.webp", ORIGIN), null);
  });
});
