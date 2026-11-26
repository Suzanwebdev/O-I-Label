import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendFirstReviewRewardEmail } from "@/lib/email/resend";
import { normalizeDiscountCode } from "@/lib/checkout/discount";
import {
  formatBrandedSms,
  normalizeSmsRecipient,
  trySendOrderSms,
} from "@/lib/sms/order-notifications";

export const FIRST_REVIEW_REWARD_PERCENT = 10;

function generateRewardCode(): string {
  return normalizeDiscountCode(`THANKS-${randomBytes(4).toString("hex")}`);
}

function buildRewardSmsBody(code: string): string {
  return `Thanks for your first review! Enjoy ${FIRST_REVIEW_REWARD_PERCENT}% off your next order with code ${code}.`;
}

/**
 * Creates a unique single-use 10% discount and delivers it by email and/or SMS.
 * Non-fatal to review submit — failures are logged, not thrown to the shopper.
 */
export async function grantFirstReviewReward(opts: {
  service: SupabaseClient;
  customerId: string;
  reviewId: string;
}): Promise<{ code: string } | null> {
  const { service, customerId, reviewId } = opts;

  const { count, error: countError } = await service
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);

  if (countError) {
    console.error("[reviews] first-reward count:", countError.message);
    return null;
  }
  // Only the customer's first successfully saved review earns the gift.
  if ((count ?? 0) !== 1) return null;

  const { data: customer } = await service
    .from("customers")
    .select("email, full_name, phone")
    .eq("id", customerId)
    .maybeSingle();

  let email = typeof customer?.email === "string" ? customer.email.trim() : "";
  let phoneRaw = typeof customer?.phone === "string" ? customer.phone.trim() : "";
  const fullName = typeof customer?.full_name === "string" ? customer.full_name : null;

  if (!email || !phoneRaw) {
    const { data: review } = await service
      .from("reviews")
      .select("order_id")
      .eq("id", reviewId)
      .maybeSingle();
    if (review?.order_id) {
      const { data: order } = await service
        .from("orders")
        .select("email, phone")
        .eq("id", review.order_id)
        .maybeSingle();
      if (!email && typeof order?.email === "string") {
        email = order.email.trim();
      }
      if (!phoneRaw && typeof order?.phone === "string") {
        phoneRaw = order.phone.trim();
      }
    }
  }

  const phone = normalizeSmsRecipient(phoneRaw);
  if (!email && !phone) {
    console.warn("[reviews] first-reward skipped: no email or phone for customer", customerId);
    return null;
  }

  let code: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateRewardCode();
    const { data: row, error } = await service
      .from("discounts")
      .insert({
        code: candidate,
        kind: "percent",
        value: FIRST_REVIEW_REWARD_PERCENT,
        min_spend_ghs: null,
        usage_limit: 1,
        used_count: 0,
        starts_at: new Date().toISOString(),
        ends_at: null,
        is_active: true,
      })
      .select("code")
      .single();

    if (!error && row?.code) {
      code = String(row.code);
      break;
    }
    // Unique violation — try another code.
    if (error?.code !== "23505") {
      console.error("[reviews] first-reward discount insert:", error?.message);
      return null;
    }
  }

  if (!code) {
    console.error("[reviews] first-reward could not allocate unique code");
    return null;
  }

  const firstName = fullName?.trim().split(/\s+/).filter(Boolean)[0] ?? null;

  if (email) {
    const mail = await sendFirstReviewRewardEmail({
      to: email,
      firstName,
      code,
    });
    if (!("sent" in mail && mail.sent)) {
      console.warn(
        "[reviews] first-reward email not sent:",
        "skipped" in mail ? mail.reason : "error" in mail ? mail.error : "unknown"
      );
    }
  }

  if (phone) {
    const message = formatBrandedSms(buildRewardSmsBody(code), firstName);
    const sms = await trySendOrderSms({
      recipient: phone,
      message,
      ref: `rev${reviewId.replace(/-/g, "").slice(0, 10)}${Date.now().toString(36).slice(-4)}`,
    });
    if (!sms.ok) {
      console.warn("[reviews] first-reward SMS failed:", sms.error);
    } else if (!sms.sent) {
      console.warn("[reviews] first-reward SMS not sent:", sms.reason);
    }
  }

  return { code };
}
