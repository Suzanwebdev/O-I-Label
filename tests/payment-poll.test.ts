import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPaymentPollExhausted,
  PAYMENT_POLL_INITIAL_DELAY_MS,
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_MAX_ATTEMPTS,
  paymentPollDelayMs,
  paymentPollWindowMs,
} from "../lib/checkout/payment-poll.ts";

describe("payment poll schedule", () => {
  it("extends beyond the original ~2 minute window to cover delayed MoMo PAID", () => {
    const previousWindowMs = 2500 + 23 * 5000; // prior 24-attempt schedule
    const currentWindowMs = paymentPollWindowMs();

    assert.equal(PAYMENT_POLL_MAX_ATTEMPTS, 72);
    assert.ok(currentWindowMs > previousWindowMs);
    // Affected order paid ~162s after create; schedule must exceed that with margin.
    assert.ok(currentWindowMs > 162_000);
    // Still finite — roughly six minutes, not indefinite.
    assert.ok(currentWindowMs < 7 * 60_000);
  });

  it("uses a short first delay then a steady interval", () => {
    assert.equal(paymentPollDelayMs(0), PAYMENT_POLL_INITIAL_DELAY_MS);
    assert.equal(paymentPollDelayMs(1), PAYMENT_POLL_INTERVAL_MS);
    assert.equal(paymentPollDelayMs(40), PAYMENT_POLL_INTERVAL_MS);
  });

  it("marks the poll window exhausted only after max attempts", () => {
    assert.equal(isPaymentPollExhausted(0), false);
    assert.equal(isPaymentPollExhausted(PAYMENT_POLL_MAX_ATTEMPTS - 1), false);
    assert.equal(isPaymentPollExhausted(PAYMENT_POLL_MAX_ATTEMPTS), true);
    assert.equal(isPaymentPollExhausted(PAYMENT_POLL_MAX_ATTEMPTS + 5), true);
  });
});
