import { getEmailFooterLinks } from "@/lib/email/brand";
import { dispatchStoreCampaignEmail } from "@/lib/email/resend";
import { renderCustomerMessageEmail } from "@/lib/email/templates/customer-message";
import { normalizeNewsletterEmail } from "@/lib/newsletter/subscribe-utils";
import { normalizeSmsRecipient } from "@/lib/sms/order-notifications";
import { sendMoolreSms } from "@/lib/sms/moolre";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type CustomerMessageChannel = "email" | "sms" | "both";

export type CustomerMessageRecipient = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
};

export type CustomerMessageResultRow = {
  customerId: string;
  email?: string | null;
  phone?: string | null;
  emailStatus?: "sent" | "failed" | "skipped";
  smsStatus?: "sent" | "failed" | "skipped";
  reason?: string;
};

const MAX_RECIPIENTS = 100;

export function customerMessageLimits() {
  return { maxRecipients: MAX_RECIPIENTS };
}

export async function loadCustomersForMessaging(
  customerIds: string[]
): Promise<CustomerMessageRecipient[]> {
  const unique = [...new Set(customerIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return [];
  if (unique.length > MAX_RECIPIENTS) {
    throw new Error(`Select at most ${MAX_RECIPIENTS} customers per send.`);
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("customers")
    .select("id, email, full_name, phone")
    .in("id", unique);

  if (error) throw new Error(error.message);

  const byId = new Map(
    ((data ?? []) as CustomerMessageRecipient[]).map((row) => [row.id, row])
  );
  return unique.map((id) => byId.get(id)).filter((row): row is CustomerMessageRecipient => Boolean(row));
}

/** Normalize client-provided contacts (accounts, waitlist, orders, newsletter). */
export function normalizeMessagingRecipients(
  raw: Array<{
    id?: string | null;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    full_name?: string | null;
  }>
): CustomerMessageRecipient[] {
  const out: CustomerMessageRecipient[] = [];
  const seen = new Set<string>();

  for (const row of raw) {
    const email = typeof row.email === "string" ? row.email.trim() : "";
    const phone = typeof row.phone === "string" ? row.phone.trim() : "";
    const full_name =
      (typeof row.fullName === "string" && row.fullName.trim()) ||
      (typeof row.full_name === "string" && row.full_name.trim()) ||
      null;
    const id =
      (typeof row.id === "string" && row.id.trim()) ||
      (email ? `e:${normalizeNewsletterEmail(email)}` : phone ? `p:${phone.replace(/\D/g, "")}` : "");
    if (!id || (!email && !phone)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      email: email || null,
      phone: phone || null,
      full_name,
    });
    if (out.length >= MAX_RECIPIENTS) break;
  }

  return out;
}

async function optedOutEmailSet(emails: string[]): Promise<Set<string>> {
  const normalized = [...new Set(emails.map((e) => normalizeNewsletterEmail(e)).filter(Boolean))];
  if (!normalized.length) return new Set();

  const service = createServiceRoleClient();
  const { data } = await service
    .from("newsletter_subscribers")
    .select("email_normalized, email_promo_opt_in")
    .in("email_normalized", normalized);

  const optedOut = new Set<string>();
  for (const row of data ?? []) {
    if (
      row &&
      row.email_promo_opt_in === false &&
      typeof row.email_normalized === "string"
    ) {
      optedOut.add(normalizeNewsletterEmail(row.email_normalized));
    }
  }
  return optedOut;
}

async function optedOutSmsSet(phones: string[]): Promise<Set<string>> {
  const normalized = [...new Set(phones.map((p) => normalizeSmsRecipient(p)).filter(Boolean))] as string[];
  if (!normalized.length) return new Set();

  const service = createServiceRoleClient();
  const { data } = await service
    .from("newsletter_subscribers")
    .select("phone_e164, sms_promo_opt_in")
    .in("phone_e164", normalized);

  const optedOut = new Set<string>();
  for (const row of data ?? []) {
    if (row && row.sms_promo_opt_in === false && typeof row.phone_e164 === "string") {
      optedOut.add(row.phone_e164);
    }
  }
  return optedOut;
}

export async function sendCustomerMessages(opts: {
  recipients: CustomerMessageRecipient[];
  channel: CustomerMessageChannel;
  subject?: string;
  message: string;
  actorId: string;
  respectPromoOptOut?: boolean;
}): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  results: CustomerMessageResultRow[];
  campaignId: string | null;
}> {
  const message = opts.message.trim();
  if (!message) throw new Error("Message is required.");
  if (message.length > 4000) throw new Error("Message is too long (max 4000 characters).");

  const channel = opts.channel;
  const subject = (opts.subject ?? "").trim();
  if ((channel === "email" || channel === "both") && !subject) {
    throw new Error("Subject is required for email.");
  }
  if (channel === "sms" || channel === "both") {
    if (message.length > 480) {
      throw new Error("SMS message is too long (max 480 characters).");
    }
  }

  const respectOptOut = opts.respectPromoOptOut !== false;
  const emails = opts.recipients.map((r) => r.email ?? "").filter(Boolean);
  const phones = opts.recipients.map((r) => r.phone ?? "").filter(Boolean);
  const [emailOptOut, smsOptOut] = await Promise.all([
    respectOptOut && (channel === "email" || channel === "both")
      ? optedOutEmailSet(emails)
      : Promise.resolve(new Set<string>()),
    respectOptOut && (channel === "sms" || channel === "both")
      ? optedOutSmsSet(phones)
      : Promise.resolve(new Set<string>()),
  ]);

  const footerLinks =
    channel === "email" || channel === "both" ? await getEmailFooterLinks() : null;

  const results: CustomerMessageResultRow[] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const smsBatch: { recipient: string; message: string; ref: string; customerId: string }[] = [];

  for (const recipient of opts.recipients) {
    const row: CustomerMessageResultRow = {
      customerId: recipient.id,
      email: recipient.email,
      phone: recipient.phone,
    };

    if (channel === "email" || channel === "both") {
      const email = recipient.email?.trim() ?? "";
      if (!email) {
        row.emailStatus = "skipped";
        row.reason = "Missing email";
        skipped += 1;
      } else if (emailOptOut.has(normalizeNewsletterEmail(email))) {
        row.emailStatus = "skipped";
        row.reason = "Email promo opted out";
        skipped += 1;
      } else if (footerLinks) {
        const rendered = renderCustomerMessageEmail({
          subject,
          message,
          firstName: recipient.full_name?.split(/\s+/)[0] ?? null,
          footerLinks,
        });
        const result = await dispatchStoreCampaignEmail({
          to: email,
          subject: rendered.subject,
          html: rendered.html,
        });
        if ("sent" in result && result.sent) {
          row.emailStatus = "sent";
          sent += 1;
        } else if ("skipped" in result && result.skipped) {
          row.emailStatus = "skipped";
          row.reason = result.reason;
          skipped += 1;
        } else {
          row.emailStatus = "failed";
          row.reason = "error" in result ? result.error : "Email failed";
          failed += 1;
        }
      }
    }

    if (channel === "sms" || channel === "both") {
      const normalized = normalizeSmsRecipient(recipient.phone);
      if (!normalized) {
        row.smsStatus = "skipped";
        row.reason = row.reason ?? "Missing or invalid phone";
        skipped += 1;
      } else if (smsOptOut.has(normalized)) {
        row.smsStatus = "skipped";
        row.reason = "SMS promo opted out";
        skipped += 1;
      } else {
        smsBatch.push({
          customerId: recipient.id,
          recipient: normalized,
          message: `O&I Label: ${message}`.slice(0, 480),
          ref: `cust-${recipient.id.slice(0, 8)}`,
        });
        row.smsStatus = "sent"; // provisional; corrected after batch
        row.phone = normalized;
      }
    }

    results.push(row);
  }

  if (smsBatch.length) {
    const senderid =
      process.env.MOOLRE_SMS_SENDER_ID?.trim() || process.env.SMS_SENDER_ID?.trim() || "";
    if (!senderid) {
      for (const item of smsBatch) {
        const row = results.find((r) => r.customerId === item.customerId);
        if (row) {
          row.smsStatus = "skipped";
          row.reason = "SMS sender ID not configured";
        }
        skipped += 1;
      }
    } else {
      try {
        await sendMoolreSms({
          senderid,
          messages: smsBatch.map(({ recipient, message, ref }) => ({ recipient, message, ref })),
        });
        sent += smsBatch.length;
      } catch (e) {
        const err = e instanceof Error ? e.message : "SMS send failed";
        for (const item of smsBatch) {
          const row = results.find((r) => r.customerId === item.customerId);
          if (row) {
            row.smsStatus = "failed";
            row.reason = err;
          }
          failed += 1;
        }
      }
    }
  }

  let campaignId: string | null = null;
  try {
    const service = createServiceRoleClient();
    const { data } = await service
      .from("store_email_campaigns")
      .insert({
        campaign_type: "customer_message",
        subject: subject || `SMS: ${message.slice(0, 80)}`,
        recipient_count: opts.recipients.length,
        sent_count: sent,
        failed_count: failed,
        status: failed > 0 && sent === 0 ? "failed" : "completed",
        created_by: opts.actorId,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    campaignId = (data as { id?: string } | null)?.id ?? null;
  } catch {
    /* non-fatal audit */
  }

  return { sent, failed, skipped, results, campaignId };
}
