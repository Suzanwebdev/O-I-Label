import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heroSlideImageIndices } from "../components/home/home-hero.tsx";

describe("hero slide image loading", () => {
  it("loads only the first slide when there is one", () => {
    assert.deepEqual([...heroSlideImageIndices(0, 1)], [0]);
  });

  it("loads previous, active, and next — not the full deck", () => {
    assert.deepEqual([...heroSlideImageIndices(0, 6)].sort((a, b) => a - b), [0, 1, 5]);
    assert.deepEqual([...heroSlideImageIndices(2, 6)].sort((a, b) => a - b), [1, 2, 3]);
  });

  it("does not mark every slide for loading", () => {
    assert.equal(heroSlideImageIndices(0, 6).size, 3);
    assert.equal(heroSlideImageIndices(0, 6).has(3), false);
  });
});
