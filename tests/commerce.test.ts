import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeRedirectPath } from "../lib/auth/safe-redirect.ts";
import {
  createOrderAccessToken,
  createStoreAccessToken,
  verifyOrderAccessToken,
  verifyStoreAccessToken,
} from "../lib/auth/signed-token.ts";
import {
  aggregateVariantQuantities,
  findInsufficientStock,
} from "../lib/inventory/deduct-order-stock.ts";
import { isAllowedProductImagePath } from "../lib/catalog/product-image-url.ts";
import {
  parseMoolreWebhook,
  verifyMoolreWebhookSignature,
} from "../lib/payments/providers/moolre.ts";

describe("safeRedirectPath", () => {
  it("allows same-site relative paths", () => {
    assert.equal(safeRedirectPath("/account/orders", "/"), "/account/orders");
  });

  it("blocks open redirects", () => {
    assert.equal(safeRedirectPath("https://evil.test", "/"), "/");
    assert.equal(safeRedirectPath("//evil.test", "/"), "/");
  });
});

describe("signed access tokens", () => {
  it("issues and verifies store access cookies", () => {
    const token = createStoreAccessToken(3600);
    assert.equal(verifyStoreAccessToken(token, 3600), true);
    assert.equal(verifyStoreAccessToken("forged.token", 3600), false);
  });

  it("issues and verifies checkout order access tokens", () => {
    const orderId = "11111111-1111-1111-1111-111111111111";
    const token = createOrderAccessToken(orderId);
    assert.equal(verifyOrderAccessToken(orderId, token), true);
    assert.equal(verifyOrderAccessToken(orderId, "bad.token"), false);
  });
});

describe("product image paths", () => {
  it("allows supabase https urls and storage paths", () => {
    assert.equal(
      isAllowedProductImagePath("https://example.supabase.co/storage/v1/object/public/product-images/catalog/a.jpg"),
      true
    );
    assert.equal(isAllowedProductImagePath("catalog/a.jpg"), true);
  });

  it("rejects javascript and traversal paths", () => {
    assert.equal(isAllowedProductImagePath("javascript:alert(1)"), false);
    assert.equal(isAllowedProductImagePath("../secrets.env"), false);
    assert.equal(isAllowedProductImagePath("data:image/png;base64,abc"), false);
  });
});

describe("inventory helpers", () => {
  it("aggregates variant quantities", () => {
    const map = aggregateVariantQuantities([
      { variantId: "a", quantity: 2 },
      { variantId: "a", quantity: 1 },
      { variantId: "b", quantity: 1 },
    ]);
    assert.equal(map.get("a"), 3);
    assert.equal(map.get("b"), 1);
  });

  it("detects insufficient stock", () => {
    const requested = new Map([["v1", 3]]);
    const short = findInsufficientStock(requested, [{ id: "v1", stock: 2, sku: "SKU-1" }]);
    assert.equal(short.length, 1);
    assert.equal(short[0]?.available, 2);
  });
});

describe("moolre webhook", () => {
  it("parses successful payment payload", () => {
    const parsed = parseMoolreWebhook({
      status: 1,
      code: "PV05",
      data: { reference: "ref_123", amount: "120.00", metadata: { order_id: "ord-1" } },
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.reference, "ref_123");
    assert.equal(parsed.orderId, "ord-1");
    assert.equal(parsed.amountGhs, 120);
  });

  it("rejects webhooks without secret in production", () => {
    const prevNode = process.env.NODE_ENV;
    const prevSecret = process.env.MOOLRE_WEBHOOK_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.MOOLRE_WEBHOOK_SECRET;
    delete process.env.MOOLRE_CALLBACK_SECRET;

    assert.equal(
      verifyMoolreWebhookSignature("{}", null, { status: 1, code: "PV05", data: { reference: "x" } }),
      false
    );

    process.env.NODE_ENV = prevNode;
    if (prevSecret) process.env.MOOLRE_WEBHOOK_SECRET = prevSecret;
  });
});
