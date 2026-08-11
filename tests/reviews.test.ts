import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPurchasedVariantLine,
  roundRating,
  sanitizeDisplayName,
} from "../lib/reviews/types.ts";

describe("review helpers", () => {
  it("formats color and size as Black · M", () => {
    assert.equal(formatPurchasedVariantLine("Black", "M"), "Black · M");
    assert.equal(formatPurchasedVariantLine("Black", null), "Black");
    assert.equal(formatPurchasedVariantLine(null, "M"), "M");
    assert.equal(formatPurchasedVariantLine(null, null), null);
  });

  it("sanitizes display names and blocks emails", () => {
    assert.equal(sanitizeDisplayName("Ama K.", "Guest"), "Ama K.");
    assert.equal(sanitizeDisplayName("ama@example.com", "Guest"), "Guest");
    assert.equal(sanitizeDisplayName("   ", "Guest"), "Guest");
  });

  it("rounds ratings to one decimal", () => {
    assert.equal(roundRating(4.833333), 4.8);
    assert.equal(roundRating(5), 5);
  });
});
