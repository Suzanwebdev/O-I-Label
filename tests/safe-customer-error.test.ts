import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateIncidentId,
  isIncidentIdSafe,
  isSafeCustomerMessage,
  looksLikeInternalError,
  sanitizeAuthErrorForOperation,
  sanitizeCustomerError,
} from "../lib/errors/safe-response.ts";

describe("generateIncidentId", () => {
  it("produces safe, non-sensitive reference IDs", () => {
    const id = generateIncidentId();
    assert.match(id, /^oi_[a-z0-9]+_[a-z0-9]{6}$/);
    assert.equal(isIncidentIdSafe(id), true);
    assert.equal(id.includes("@"), false);
    assert.equal(id.includes("MOOLRE"), false);
  });
});

describe("looksLikeInternalError", () => {
  it("flags provider, env, database, and stack-trace messages", () => {
    assert.equal(looksLikeInternalError("MOOLRE_API_USER is not configured"), true);
    assert.equal(
      looksLikeInternalError('duplicate key value violates unique constraint "orders_pkey"'),
      true
    );
    assert.equal(looksLikeInternalError("TypeError: fetch failed at lib/payments.ts (12:3)"), true);
    assert.equal(looksLikeInternalError("SUPABASE_SERVICE_ROLE_KEY missing"), true);
  });

  it("does not flag ordinary validation copy", () => {
    assert.equal(looksLikeInternalError("Valid email is required"), false);
    assert.equal(
      looksLikeInternalError("Not enough stock for one or more items. Please adjust quantities and try again."),
      false
    );
  });
});

describe("sanitizeCustomerError", () => {
  it("never exposes raw Moolre/provider errors to customers", () => {
    const result = sanitizeCustomerError({
      operation: "checkout_payment",
      message: "MOOLRE_API_USER is not configured",
    });
    assert.equal(result.error.includes("MOOLRE"), false);
    assert.equal(
      result.error,
      "We couldn't process your payment right now. Please try again or use another payment method."
    );
    assert.ok(result.incidentId);
    assert.equal(isIncidentIdSafe(result.incidentId!), true);
  });

  it("never exposes raw Supabase/Postgres errors to customers", () => {
    const result = sanitizeCustomerError({
      operation: "checkout",
      message: 'insert or update on table "orders" violates foreign key constraint "orders_customer_id_fkey"',
    });
    assert.equal(result.error.includes("orders_customer_id_fkey"), false);
    assert.equal(result.error, "We couldn't complete checkout right now. Please try again.");
    assert.ok(result.incidentId);
  });

  it("preserves trusted validation messages", () => {
    const result = sanitizeCustomerError({
      operation: "checkout",
      message: "Valid email is required",
      trusted: true,
    });
    assert.deepEqual(result, { error: "Valid email is required" });
  });

  it("preserves safe validation messages without trusted flag", () => {
    const result = sanitizeCustomerError({
      operation: "checkout",
      message: "Not enough stock for one or more items. Please adjust quantities and try again.",
    });
    assert.deepEqual(result, {
      error: "Not enough stock for one or more items. Please adjust quantities and try again.",
    });
  });

  it("returns generic copy and incident ID for unexpected failures", () => {
    const result = sanitizeCustomerError({
      operation: "newsletter",
      message: "connection to server at db.supabase.co failed",
    });
    assert.equal(result.error, "We couldn't complete your signup right now. Please try again.");
    assert.ok(result.incidentId);
  });
});

describe("sanitizeAuthErrorForOperation", () => {
  it("preserves useful safe Supabase auth messages", () => {
    assert.equal(
      sanitizeAuthErrorForOperation("auth_sign_in", { message: "Invalid login credentials" }),
      "Invalid login credentials"
    );
    assert.equal(
      sanitizeAuthErrorForOperation("auth_sign_up", { message: "User already registered" }),
      "User already registered"
    );
    assert.match(
      sanitizeAuthErrorForOperation("auth_reset_request", {
        message: "For security purposes, you can only request this once every 60 seconds",
      }),
      /once every 60 seconds/i
    );
  });

  it("sanitizes internal auth/provider failures", () => {
    assert.equal(
      sanitizeAuthErrorForOperation("auth_sign_in", {
        message: "AuthRetryableFetchError: fetch failed",
      }),
      "Unable to sign in right now. Please try again."
    );
    assert.equal(
      sanitizeAuthErrorForOperation("auth_sign_up", {
        message: "Database error saving new user",
      }),
      "Unable to create account right now. Please try again."
    );
  });
});

describe("isSafeCustomerMessage", () => {
  it("rejects internal-looking strings", () => {
    assert.equal(isSafeCustomerMessage("PGRST116: JSON object requested, multiple (or no) rows returned"), false);
  });

  it("accepts short customer-safe strings", () => {
    assert.equal(isSafeCustomerMessage("Invalid discount code"), true);
  });
});
