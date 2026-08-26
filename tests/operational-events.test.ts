import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  buildOperationalFingerprint,
  captureOperationalEvent,
  createMemoryOperationalEventStore,
  setOperationalEventTestStore,
} from "../lib/errors/capture-event.ts";
import {
  sanitizeOperationalMessage,
  sanitizeOperationalMetadata,
  stabilizeFingerprintToken,
} from "../lib/errors/sanitize.ts";
import { apiCustomerErrorResponse } from "../lib/errors/api-error-response.ts";
import { sanitizeCustomerError } from "../lib/errors/safe-response.ts";
import { notifyRestockSubscribers } from "../lib/restock-notifications/notify.ts";
import { maybeNotifyRestockAfterAdminStockChange } from "../lib/restock-notifications/admin-side-effect.ts";

afterEach(() => {
  setOperationalEventTestStore(null);
});

describe("sanitizeOperationalMetadata", () => {
  it("redacts secrets, tokens, emails, and sensitive keys", () => {
    const cleaned = sanitizeOperationalMetadata({
      api_key: "sk_live_abc",
      password: "hunter2",
      webhook_secret: "whsec_123",
      unsubscribe_token: "11111111-1111-1111-1111-111111111111",
      email: "customer@example.com",
      note: "Contact customer@example.com about order 22222222-2222-2222-2222-222222222222",
      reason: "amount_mismatch",
    });
    assert.equal(cleaned.api_key, "[redacted]");
    assert.equal(cleaned.password, "[redacted]");
    assert.equal(cleaned.webhook_secret, "[redacted]");
    assert.equal(cleaned.unsubscribe_token, "[redacted]");
    assert.equal(cleaned.email, "[email]");
    assert.match(String(cleaned.note), /\[email\]/);
    assert.match(String(cleaned.note), /\[id\]/);
    assert.equal(cleaned.reason, "amount_mismatch");
    assert.equal(JSON.stringify(cleaned).includes("sk_live"), false);
    assert.equal(JSON.stringify(cleaned).includes("customer@"), false);
  });
});

describe("sanitizeOperationalMessage", () => {
  it("removes emails and UUIDs from stored messages", () => {
    const msg = sanitizeOperationalMessage(
      "Failed for user@example.com order 33333333-3333-3333-3333-333333333333"
    );
    assert.equal(msg.includes("user@"), false);
    assert.equal(msg.includes("33333333"), false);
  });
});

describe("buildOperationalFingerprint", () => {
  it("is stable across volatile values", () => {
    const a = buildOperationalFingerprint({
      category: "payment",
      surface: "storefront",
      code: "payment_init",
    });
    const b = buildOperationalFingerprint({
      category: "payment",
      surface: "storefront",
      code: "payment_init",
    });
    assert.equal(a, "payment:storefront:payment_init");
    assert.equal(a, b);

    const noisy = buildOperationalFingerprint({
      category: "checkout",
      surface: "storefront",
      code: `order_create for 44444444-4444-4444-4444-444444444444 at ${Date.now()}`,
    });
    assert.equal(noisy.includes("44444444"), false);
    assert.match(noisy, /^checkout:storefront:/);
    assert.equal(noisy.includes("@"), false);
  });

  it("stabilizes tokens consistently", () => {
    assert.equal(stabilizeFingerprintToken("Payment Init!!"), "payment_init");
  });
});

describe("captureOperationalEvent", () => {
  it("creates an open event with required fields", async () => {
    const store = createMemoryOperationalEventStore();
    const result = await captureOperationalEvent(
      {
        severity: "error",
        category: "checkout",
        surface: "storefront",
        code: "order_create",
        message: "Could not create order",
        incidentId: "oi_test_abc123",
        metadata: { http_status: 500 },
      },
      store
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.created, true);
    assert.equal(result.event.status, "open");
    assert.equal(result.event.occurrence_count, 1);
    assert.equal(result.event.incident_id, "oi_test_abc123");
    assert.equal(result.event.fingerprint, "checkout:storefront:order_create");
    assert.equal(result.event.category, "checkout");
    assert.equal(result.event.surface, "storefront");
    assert.equal(result.event.severity, "error");
    assert.ok(result.event.first_seen_at);
    assert.ok(result.event.last_seen_at);
    assert.equal(result.event.first_seen_at, result.event.last_seen_at);
    assert.equal(result.event.metadata.http_status, 500);
  });

  it("aggregates duplicates by fingerprint", async () => {
    const store = createMemoryOperationalEventStore();
    const first = await captureOperationalEvent(
      {
        severity: "critical",
        category: "payment",
        surface: "storefront",
        code: "payment_init",
        message: "MOOLRE_API_USER is not configured",
        incidentId: "oi_first_aaaaaa",
      },
      store
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const firstSeen = first.event.first_seen_at;

    await new Promise((r) => setTimeout(r, 5));

    const second = await captureOperationalEvent(
      {
        severity: "critical",
        category: "payment",
        surface: "storefront",
        code: "payment_init",
        message: "MOOLRE_API_USER is not configured",
        incidentId: "oi_second_bbbbbb",
      },
      store
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.created, false);
    assert.equal(second.event.id, first.event.id);
    assert.equal(second.event.occurrence_count, 2);
    assert.equal(second.event.first_seen_at, firstSeen);
    assert.notEqual(second.event.last_seen_at, firstSeen);
    assert.equal(store.rows.length, 1);
    assert.equal(second.event.metadata.latest_incident_id, "oi_second_bbbbbb");
  });

  it("never stores secrets or PII in metadata", async () => {
    const store = createMemoryOperationalEventStore();
    const result = await captureOperationalEvent(
      {
        severity: "error",
        category: "email",
        surface: "storefront",
        code: "order_confirmation_send_failed",
        message: "Resend failed for buyer@example.com",
        metadata: {
          to: "buyer@example.com",
          api_key: "re_secret",
          html: "<p>secret body</p>",
        },
      },
      store
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const blob = JSON.stringify(result.event);
    assert.equal(blob.includes("buyer@"), false);
    assert.equal(blob.includes("re_secret"), false);
    assert.equal(result.event.metadata.api_key, "[redacted]");
  });

  it("capture failure does not throw and leaves the original operation intact", async () => {
    const brokenStore = {
      async findOpenByFingerprint() {
        throw new Error("db down");
      },
      async insert() {
        throw new Error("db down");
      },
      async incrementOccurrence() {
        throw new Error("db down");
      },
    };
    const customer = sanitizeCustomerError({
      operation: "checkout_payment",
      message: "MOOLRE_API_USER is not configured",
    });
    const capture = await captureOperationalEvent(
      {
        severity: "critical",
        category: "payment",
        surface: "storefront",
        code: "payment_init",
        message: "MOOLRE_API_USER is not configured",
        incidentId: customer.incidentId,
      },
      brokenStore
    );
    assert.equal(capture.ok, false);
    assert.equal(
      customer.error,
      "We couldn't process your payment right now. Please try again or use another payment method."
    );
    assert.ok(customer.incidentId);
  });
});

describe("hook observations", () => {
  it("checkout failure creates a payment event while keeping Phase 4B customer envelope", async () => {
    const store = createMemoryOperationalEventStore();
    setOperationalEventTestStore(store);
    const res = apiCustomerErrorResponse(502, {
      operation: "checkout_payment",
      message: "MOOLRE_API_USER is not configured",
      capture: {
        severity: "critical",
        category: "payment",
        surface: "storefront",
        code: "payment_init",
      },
    });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(
      body.error,
      "We couldn't process your payment right now. Please try again or use another payment method."
    );
    assert.ok(body.incidentId);
    assert.equal(body.error.includes("MOOLRE"), false);

    await new Promise((r) => setTimeout(r, 20));
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0]?.fingerprint, "payment:storefront:payment_init");
    assert.equal(store.rows[0]?.incident_id, body.incidentId);
  });

  it("webhook / inventory / email / auth codes create distinct events", async () => {
    const store = createMemoryOperationalEventStore();
    const specs = [
      {
        severity: "warning" as const,
        category: "webhook" as const,
        surface: "webhook" as const,
        code: "moolre_verify",
        message: "Moolre webhook signature verification failed",
      },
      {
        severity: "critical" as const,
        category: "payment" as const,
        surface: "webhook" as const,
        code: "moolre_amount_mismatch",
        message: "Moolre webhook processing failed: amount_mismatch",
      },
      {
        severity: "critical" as const,
        category: "inventory" as const,
        surface: "webhook" as const,
        code: "paid_order_variant_update",
        message: "Paid-order inventory deduction failed: variant_update",
      },
      {
        severity: "error" as const,
        category: "email" as const,
        surface: "storefront" as const,
        code: "order_confirmation_send_failed",
        message: "Resend email send failed",
      },
      {
        severity: "error" as const,
        category: "auth" as const,
        surface: "storefront" as const,
        code: "callback_exchange_failed",
        message: "Authentication code exchange failed",
      },
    ];
    for (const spec of specs) {
      const result = await captureOperationalEvent(spec, store);
      assert.equal(result.ok, true);
    }
    assert.equal(store.rows.length, 5);
  });

  it("restock notification send failure creates a restock event", async () => {
    const store = createMemoryOperationalEventStore();
    setOperationalEventTestStore(store);

    const summary = await notifyRestockSubscribers(
      "11111111-1111-4111-8111-111111111111",
      {
        async loadProduct() {
          return {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Test Dress",
            slug: "test-dress",
            imageUrl: "https://cdn.example/p.jpg",
            isActive: true,
          };
        },
        async listActiveSubscriptions() {
          return [
            {
              id: "sub-1",
              emailRaw: "shopper@example.com",
              status: "active",
              unsubscribeToken: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            },
          ];
        },
        async markNotified() {},
      },
      async () => {
        throw new Error("smtp boom");
      }
    );

    assert.equal(summary.failed, 1);
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(store.rows.some((r) => r.fingerprint === "restock:admin:restock_email_exception"));
    assert.equal(JSON.stringify(store.rows).includes("shopper@"), false);
  });

  it("restock pipeline failure after admin stock update creates an event", async () => {
    const store = createMemoryOperationalEventStore();
    setOperationalEventTestStore(store);
    const result = await maybeNotifyRestockAfterAdminStockChange({
      productId: "11111111-1111-4111-8111-111111111111",
      beforeVariants: [{ id: "v1", stock: 0 }],
      afterVariants: [{ id: "v1", stock: 3 }],
      notify: async () => {
        throw new Error("notify pipeline exploded");
      },
    });
    assert.equal(result.shouldNotify, true);
    assert.equal(result.notified, false);
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(store.rows.some((r) => r.fingerprint === "restock:admin:restock_notify_pipeline"));
  });
});

describe("domain observation fingerprints", () => {
  it("checkout / webhook / inventory / email / restock / auth codes are distinct and stable", () => {
    const cases = [
      ["checkout", "storefront", "order_create"],
      ["payment", "storefront", "payment_init"],
      ["webhook", "webhook", "moolre_verify"],
      ["payment", "webhook", "moolre_amount_mismatch"],
      ["inventory", "webhook", "paid_order_variant_update"],
      ["email", "storefront", "order_confirmation_send_failed"],
      ["restock", "admin", "restock_available_send_failed"],
      ["auth", "storefront", "callback_exchange_failed"],
    ] as const;

    const fingerprints = cases.map(([category, surface, code]) =>
      buildOperationalFingerprint({ category, surface, code })
    );
    assert.equal(new Set(fingerprints).size, fingerprints.length);
    for (const fp of fingerprints) {
      assert.match(fp, /^[a-z]+:[a-z]+:[a-z0-9_:-]+$/);
    }
  });
});
