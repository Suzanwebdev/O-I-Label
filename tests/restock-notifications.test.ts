import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectVariantColors,
  collectVariantSizes,
  isProductCompletelySoldOut,
  isValidProductId,
  isValidRestockEmail,
  normalizePreferenceAny,
  normalizeRestockEmail,
  normalizeRestockSource,
  validatePreferredColor,
  validatePreferredSize,
  type RestockProductRow,
} from "../lib/restock-notifications/helpers.ts";
import {
  subscribeToRestock,
  type RestockSubscriptionStore,
} from "../lib/restock-notifications/subscribe.ts";
import { checkRateLimit } from "../lib/http/rate-limit.ts";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PRODUCT = "22222222-2222-4222-8222-222222222222";

function soldOutProduct(overrides?: Partial<RestockProductRow>): RestockProductRow {
  return {
    id: PRODUCT_ID,
    is_active: true,
    variants: [
      { id: "v1", size: "M", color: "Pink", stock: 0 },
      { id: "v2", size: "L", color: "Pink", stock: 0 },
      { id: "v3", size: "M", color: "Black", stock: 0 },
    ],
    ...overrides,
  };
}

function memoryStore(opts?: {
  product?: RestockProductRow | null;
  failInsert?: boolean;
}): {
  store: RestockSubscriptionStore;
  rows: Array<{
    emailNormalized: string;
    productId: string;
    preferredColor: string | null;
    preferredSize: string | null;
    customerId: string | null;
    source: string;
  }>;
} {
  const rows: Array<{
    emailNormalized: string;
    productId: string;
    preferredColor: string | null;
    preferredSize: string | null;
    customerId: string | null;
    source: string;
  }> = [];

  const product = opts?.product === undefined ? soldOutProduct() : opts.product;

  return {
    rows,
    store: {
      async findActiveProduct(productId) {
        if (!product || product.id !== productId) return null;
        return product;
      },
      async findActiveSubscription({
        emailNormalized,
        productId,
        preferredColor,
        preferredSize,
      }) {
        const hit = rows.find(
          (r) =>
            r.emailNormalized === emailNormalized &&
            r.productId === productId &&
            r.preferredColor === preferredColor &&
            r.preferredSize === preferredSize
        );
        return hit ? { id: "existing" } : null;
      },
      async insertSubscription(row) {
        if (opts?.failInsert) return { ok: false, duplicate: false, error: "db" };
        const dup = rows.some(
          (r) =>
            r.emailNormalized === row.emailNormalized &&
            r.productId === row.productId &&
            r.preferredColor === row.preferredColor &&
            r.preferredSize === row.preferredSize
        );
        if (dup) return { ok: false, duplicate: true };
        rows.push({
          emailNormalized: row.emailNormalized,
          productId: row.productId,
          preferredColor: row.preferredColor,
          preferredSize: row.preferredSize,
          customerId: row.customerId,
          source: row.source,
        });
        return { ok: true };
      },
    },
  };
}

describe("restock helpers", () => {
  it("normalizes email lowercase trimmed", () => {
    assert.equal(normalizeRestockEmail("  Ama@Example.COM "), "ama@example.com");
    assert.equal(isValidRestockEmail("ama@example.com"), true);
    assert.equal(isValidRestockEmail("not-an-email"), false);
    assert.equal(isValidRestockEmail(""), false);
  });

  it("validates product uuid", () => {
    assert.equal(isValidProductId(PRODUCT_ID), true);
    assert.equal(isValidProductId("not-a-uuid"), false);
  });

  it("product completely sold out only when all variants stock <= 0", () => {
    assert.equal(
      isProductCompletelySoldOut([
        { stock: 0 },
        { stock: 0 },
        { stock: 0 },
      ]),
      true
    );
    assert.equal(
      isProductCompletelySoldOut([
        { stock: 0 },
        { stock: 1 },
        { stock: 0 },
      ]),
      false
    );
    assert.equal(
      isProductCompletelySoldOut([
        { stock: 5 },
        { stock: 0 },
        { stock: 0 },
      ]),
      false
    );
    assert.equal(isProductCompletelySoldOut([]), false);
  });

  it("treats empty / Any as null preference", () => {
    assert.equal(normalizePreferenceAny(null), null);
    assert.equal(normalizePreferenceAny(""), null);
    assert.equal(normalizePreferenceAny("Any"), null);
    assert.equal(normalizePreferenceAny("any"), null);
    assert.equal(normalizePreferenceAny("Pink"), "Pink");
  });

  it("validates color and size against product variants", () => {
    const variants = soldOutProduct().variants;
    assert.deepEqual(collectVariantColors(variants).sort(), ["Black", "Pink"]);
    assert.deepEqual(collectVariantSizes(variants).sort(), ["L", "M"]);

    assert.equal(validatePreferredColor(null, variants).ok, true);
    assert.equal(validatePreferredColor("Pink", variants).ok, true);
    assert.equal(validatePreferredColor("Ivory", variants).ok, false);

    assert.equal(validatePreferredSize(null, variants).ok, true);
    assert.equal(validatePreferredSize("M", variants).ok, true);
    assert.equal(validatePreferredSize("XL", variants).ok, false);
  });

  it("normalizes source to allowed values", () => {
    assert.equal(normalizeRestockSource("card"), "card");
    assert.equal(normalizeRestockSource("quick_view"), "quick_view");
    assert.equal(normalizeRestockSource("evil".repeat(20)), "pdp");
    assert.equal(normalizeRestockSource(undefined), "pdp");
  });
});

describe("subscribeToRestock", () => {
  it("accepts a completely sold-out product", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      {
        productId: PRODUCT_ID,
        email: "guest@example.com",
        preferredColor: null,
        preferredSize: null,
        source: "pdp",
      },
      store
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.alreadySubscribed, false);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.customerId, null);
  });

  it("accepts multiple variants all at zero", async () => {
    const { store, rows } = memoryStore({
      product: soldOutProduct({
        variants: [
          { id: "a", size: "S", color: "Ivory", stock: 0 },
          { id: "b", size: "M", color: "Ivory", stock: 0 },
          { id: "c", size: "L", color: "Ivory", stock: 0 },
        ],
      }),
    });
    const result = await subscribeToRestock(
      { productId: PRODUCT_ID, email: "a@b.co", preferredColor: "Ivory", preferredSize: "Any" },
      store
    );
    assert.equal(result.ok, true);
    assert.equal(rows[0]?.preferredColor, "Ivory");
    assert.equal(rows[0]?.preferredSize, null);
  });

  it("rejects when one variant is in stock", async () => {
    const { store, rows } = memoryStore({
      product: soldOutProduct({
        variants: [
          { id: "a", size: "M", color: "Pink", stock: 0 },
          { id: "b", size: "L", color: "Pink", stock: 1 },
          { id: "c", size: "M", color: "Black", stock: 0 },
        ],
      }),
    });
    const result = await subscribeToRestock(
      { productId: PRODUCT_ID, email: "a@b.co" },
      store
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 409);
      assert.equal(result.code, "product_available");
    }
    assert.equal(rows.length, 0);
  });

  it("rejects when a variant has stock 5 and others are zero", async () => {
    const { store, rows } = memoryStore({
      product: soldOutProduct({
        variants: [
          { id: "a", size: "M", color: "Pink", stock: 5 },
          { id: "b", size: "L", color: "Pink", stock: 0 },
          { id: "c", size: "M", color: "Black", stock: 0 },
        ],
      }),
    });
    const result = await subscribeToRestock(
      { productId: PRODUCT_ID, email: "a@b.co" },
      store
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "product_available");
    assert.equal(rows.length, 0);
  });

  it("rejects inactive products", async () => {
    const { store, rows } = memoryStore({
      product: soldOutProduct({ is_active: false }),
    });
    const result = await subscribeToRestock(
      { productId: PRODUCT_ID, email: "a@b.co" },
      store
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 404);
      assert.equal(result.code, "invalid_product");
    }
    assert.equal(rows.length, 0);
  });

  it("rejects invalid email", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      { productId: PRODUCT_ID, email: "nope" },
      store
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_email");
    assert.equal(rows.length, 0);
  });

  it("rejects invalid product id", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      { productId: "missing", email: "a@b.co" },
      store
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 404);
      assert.equal(result.code, "invalid_product");
    }
    assert.equal(rows.length, 0);
  });

  it("rejects unknown product", async () => {
    const { store, rows } = memoryStore({ product: null });
    const result = await subscribeToRestock(
      { productId: OTHER_PRODUCT, email: "a@b.co" },
      store
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 404);
    assert.equal(rows.length, 0);
  });

  it("rejects invalid color", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      { productId: PRODUCT_ID, email: "a@b.co", preferredColor: "Neon" },
      store
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_preference");
    assert.equal(rows.length, 0);
  });

  it("rejects invalid size", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      { productId: PRODUCT_ID, email: "a@b.co", preferredSize: "XXL" },
      store
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_preference");
    assert.equal(rows.length, 0);
  });

  it("accepts Any color + Any size", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      {
        productId: PRODUCT_ID,
        email: "a@b.co",
        preferredColor: "Any",
        preferredSize: "Any",
      },
      store
    );
    assert.equal(result.ok, true);
    assert.equal(rows[0]?.preferredColor, null);
    assert.equal(rows[0]?.preferredSize, null);
  });

  it("accepts specific color + Any size", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      {
        productId: PRODUCT_ID,
        email: "a@b.co",
        preferredColor: "Pink",
        preferredSize: null,
      },
      store
    );
    assert.equal(result.ok, true);
    assert.equal(rows[0]?.preferredColor, "Pink");
    assert.equal(rows[0]?.preferredSize, null);
  });

  it("accepts Any color + specific size", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      {
        productId: PRODUCT_ID,
        email: "a@b.co",
        preferredColor: "Any",
        preferredSize: "M",
      },
      store
    );
    assert.equal(result.ok, true);
    assert.equal(rows[0]?.preferredColor, null);
    assert.equal(rows[0]?.preferredSize, "M");
  });

  it("does not create another row for duplicate active preference", async () => {
    const { store, rows } = memoryStore();
    const payload = {
      productId: PRODUCT_ID,
      email: "Dup@Example.com",
      preferredColor: "Pink",
      preferredSize: "M",
      source: "card",
    };
    const first = await subscribeToRestock(payload, store);
    const second = await subscribeToRestock(payload, store);
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.alreadySubscribed, false);
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.alreadySubscribed, true);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.emailNormalized, "dup@example.com");
  });

  it("allows same email/product with different preferences", async () => {
    const { store, rows } = memoryStore();
    const email = "same@example.com";
    const a = await subscribeToRestock(
      { productId: PRODUCT_ID, email, preferredColor: "Pink", preferredSize: "M" },
      store
    );
    const b = await subscribeToRestock(
      { productId: PRODUCT_ID, email, preferredColor: "Pink", preferredSize: "L" },
      store
    );
    const c = await subscribeToRestock(
      { productId: PRODUCT_ID, email, preferredColor: "Any", preferredSize: "M" },
      store
    );
    const d = await subscribeToRestock(
      { productId: PRODUCT_ID, email, preferredColor: "Any", preferredSize: "Any" },
      store
    );
    assert.equal(a.ok && b.ok && c.ok && d.ok, true);
    assert.equal(rows.length, 4);
  });

  it("guest subscription works without customer_id", async () => {
    const { store, rows } = memoryStore();
    const result = await subscribeToRestock(
      { productId: PRODUCT_ID, email: "guest@oi.test", source: "quick_view" },
      store
    );
    assert.equal(result.ok, true);
    assert.equal(rows[0]?.customerId, null);
    assert.equal(rows[0]?.source, "quick_view");
  });
});

describe("restock subscribe rate limit key", () => {
  it("uses the same in-memory rate limiter as other public subscribe routes", () => {
    const req = new Request("http://localhost/api/restock-notifications/subscribe", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });
    for (let i = 0; i < 15; i += 1) {
      const ok = checkRateLimit(req, "restock:subscribe", 15);
      assert.equal(ok.ok, true);
    }
    const blocked = checkRateLimit(req, "restock:subscribe", 15);
    assert.equal(blocked.ok, false);
  });
});
