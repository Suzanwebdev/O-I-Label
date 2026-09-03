/**
 * Success-page payment confirmation polling schedule.
 * Kept finite so we never poll indefinitely; recovery UI can restart a new window.
 */
export const PAYMENT_POLL_INITIAL_DELAY_MS = 2500;
export const PAYMENT_POLL_INTERVAL_MS = 5000;

/** ~6 minutes: covers delayed MoMo confirmation beyond the prior ~2 minute window. */
export const PAYMENT_POLL_MAX_ATTEMPTS = 72;

export function paymentPollDelayMs(attempt: number): number {
  return attempt === 0 ? PAYMENT_POLL_INITIAL_DELAY_MS : PAYMENT_POLL_INTERVAL_MS;
}

/** Total scheduled wait before the last attempt fires (not including request latency). */
export function paymentPollWindowMs(maxAttempts: number = PAYMENT_POLL_MAX_ATTEMPTS): number {
  if (maxAttempts <= 0) return 0;
  if (maxAttempts === 1) return PAYMENT_POLL_INITIAL_DELAY_MS;
  return PAYMENT_POLL_INITIAL_DELAY_MS + (maxAttempts - 1) * PAYMENT_POLL_INTERVAL_MS;
}

export function isPaymentPollExhausted(
  attempts: number,
  maxAttempts: number = PAYMENT_POLL_MAX_ATTEMPTS
): boolean {
  return attempts >= maxAttempts;
}
