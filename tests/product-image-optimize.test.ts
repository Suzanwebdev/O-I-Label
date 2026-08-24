import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCT_IMAGE_MAX_LONG_EDGE,
  PRODUCT_IMAGE_MAX_SOURCE_BYTES,
  catalogImageFileName,
  catalogImageOutputSize,
  validateProductImageFile,
} from "../lib/media/optimize-product-image.ts";

describe("product image upload validation", () => {
  it("accepts jpeg, png, and webp under 10 MB", () => {
    assert.equal(validateProductImageFile({ type: "image/jpeg", size: 1024 }), null);
    assert.equal(validateProductImageFile({ type: "image/png", size: 1024 }), null);
    assert.equal(validateProductImageFile({ type: "image/webp", size: 1024 }), null);
  });

  it("rejects unsupported types and oversized sources", () => {
    assert.match(
      validateProductImageFile({ type: "image/gif", size: 1024 }) ?? "",
      /JPEG, PNG, or WebP/i
    );
    assert.match(
      validateProductImageFile({ type: "image/jpeg", size: PRODUCT_IMAGE_MAX_SOURCE_BYTES + 1 }) ?? "",
      /10 MB/i
    );
  });
});

describe("product image output size", () => {
  it("scales a 4000×6000 image to a 2000px long edge without upscaling or cropping", () => {
    const out = catalogImageOutputSize(4000, 6000);
    assert.equal(out.resized, true);
    assert.equal(out.height, PRODUCT_IMAGE_MAX_LONG_EDGE);
    assert.equal(out.width, 1333);
    assert.equal(Math.abs(out.width / out.height - 4000 / 6000) < 0.002, true);
  });

  it("leaves a 1200×1800 image unchanged", () => {
    const out = catalogImageOutputSize(1200, 1800);
    assert.deepEqual(out, { width: 1200, height: 1800, resized: false });
  });
});

describe("catalog image file name", () => {
  it("uses a single webp or jpeg extension for the processed file", () => {
    assert.equal(catalogImageFileName("Look 01.JPG", "image/webp"), "Look_01.webp");
    assert.equal(catalogImageFileName("Look 01.JPG", "image/jpeg"), "Look_01.jpg");
  });
});
