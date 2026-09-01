import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldBypassImageOptimization } from "../lib/media-quality.ts";

describe("shouldBypassImageOptimization", () => {
  it("bypasses public Supabase product-images URLs", () => {
    assert.equal(
      shouldBypassImageOptimization(
        "https://example.supabase.co/storage/v1/object/public/product-images/catalog/foo.webp"
      ),
      true
    );
  });

  it("keeps local and unrelated remote assets optimized", () => {
    assert.equal(shouldBypassImageOptimization("/file.svg"), false);
    assert.equal(shouldBypassImageOptimization(""), false);
    assert.equal(
      shouldBypassImageOptimization("https://images.unsplash.com/photo-123"),
      false
    );
    assert.equal(
      shouldBypassImageOptimization(
        "https://example.supabase.co/storage/v1/object/public/other-bucket/foo.webp"
      ),
      false
    );
  });
});
