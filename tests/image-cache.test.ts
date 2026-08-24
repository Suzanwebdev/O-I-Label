import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VERSIONED_PUBLIC_IMAGE_CACHE_CONTROL,
  VERSIONED_PUBLIC_IMAGE_CACHE_MAX_AGE_SECONDS,
} from "../lib/media/image-cache.ts";

describe("versioned public image cache-control", () => {
  it("uses a one-year max-age in seconds", () => {
    assert.equal(VERSIONED_PUBLIC_IMAGE_CACHE_MAX_AGE_SECONDS, 31536000);
  });

  it("is the Supabase upload cacheControl string with immutable", () => {
    assert.equal(VERSIONED_PUBLIC_IMAGE_CACHE_CONTROL, "31536000, immutable");
  });
});
