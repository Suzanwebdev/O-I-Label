import { Resend } from "resend";
import { getEmailFooterLinks } from "@/lib/email/brand";
import { fetchOrderEmailContext } from "@/lib/email/fetch-order-email-context";
import { renderNewsletterWelcomeEmail } from "@/lib/email/templates/newsletter-welcome";
import { renderStoreCampaignEmail } from "@/lib/email/templates/store-campaigns";
import { STORE_CAMPAIGN_SUBJECTS, type WaitlistCampaignType } from "@/lib/store-control/constants";
import {
  renderOrderConfirmationEmail,
  renderOrderConfirmationEmailFallback,
} from "@/lib/email/templates/order-confirmation";
import {
  renderOrderStatusEmail,
  renderOrderStatusEmailFallback,
} from "@/lib/email/templates/order-status";
import { orderConfirmationCopy, orderStatusEmailCopy } from "@/lib/email/templates/copy";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset";
import {
  renderRestockAvailableEmail,
  restockAvailableEmailSubject,
} from "@/lib/email/templates/restock-available";
import { observeOperationalEvent } from "@/lib/errors/capture-event";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type EmailSendResult =
  | { sent: true; id?: string }
  | { skipped: true; reason: string }
  | { sent: false; error: string };

type EmailOpsContext = {
  purpose: string;
  category?: "email" | "restock";
  surface?: "storefront" | "admin" | "superadmin" | "webhook" | "cron";
};

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function fromAddress() {
  const explicit = process.env.RESEND_FROM?.trim();
  if (explicit) return explicit;
  const emailFrom = process.env.EMAIL_FROM?.trim();
  if (emailFrom) {
    const addr = emailFrom.includes("<") ? emailFrom : `O & I Label <${emailFrom}>`;
    return addr;
  }
  return "O & I Label <onboarding@resend.dev>";
}

async function dispatchEmail(
  payload: {
    from: string;
    to: string;
    subject: string;
    html: string;
  },
  ops?: EmailOpsContext
): Promise<EmailSendResult> {
  const resend = client();
  if (!resend) {
    observeOperationalEvent({
      severity: "warning",
      category: ops?.category ?? "email",
      surface: ops?.surface ?? "storefront",
      code: `${ops?.purpose ?? "email"}_not_configured`,
      message: "Resend API key is not configured",
      metadata: { purpose: ops?.purpose ?? "email", outcome: "skipped" },
    });
    return { skipped: true, reason: "RESEND_API_KEY not configured" };
  }

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.warn("Resend send failed:", error.message);
    observeOperationalEvent({
      severity: "error",
      category: ops?.category ?? "email",
      surface: ops?.surface ?? "storefront",
      code: `${ops?.purpose ?? "email"}_send_failed`,
      message: "Resend email send failed",
      metadata: {
        purpose: ops?.purpose ?? "email",
        outcome: "failed",
        provider_error_class: error.name?.slice(0, 64) || "ResendError",
      },
    });
    return { sent: false, error: error.message };
  }
  return { sent: true, id: data?.id };
}

export async function sendOrderConfirmationEmail(opts: {
  to: string;
  orderNumber: string;
  totalGhs: number;
  orderId?: string;
}): Promise<EmailSendResult> {
  const footerLinks = await getEmailFooterLinks();
  let html: string;
  let subject: string;

  if (opts.orderId) {
    try {
      const service = createServiceRoleClient();
      const ctx = await fetchOrderEmailContext(service, opts.orderId);
      if (ctx) {
        const copy = orderConfirmationCopy(ctx.customerName);
        html = renderOrderConfirmationEmail(ctx, footerLinks);
        subject = copy.subject(ctx.orderNumber);
        return dispatchEmail(
          { from: fromAddress(), to: opts.to, subject, html },
          { purpose: "order_confirmation" }
        );
      }
    } catch (e) {
      console.warn("Order confirmation email context fetch failed:", e);
    }
  }

  const copy = orderConfirmationCopy(null);
  html = renderOrderConfirmationEmailFallback(
    {
      orderNumber: opts.orderNumber,
      totalGhs: opts.totalGhs,
    },
    footerLinks
  );
  subject = copy.subject(opts.orderNumber);

  return dispatchEmail(
    { from: fromAddress(), to: opts.to, subject, html },
    { purpose: "order_confirmation" }
  );
}

export async function sendPasswordResetEmail(opts: { to: string; link: string }): Promise<EmailSendResult> {
  const footerLinks = await getEmailFooterLinks();
  return dispatchEmail(
    {
      from: fromAddress(),
      to: opts.to,
      subject: "Reset your password — O & I Label",
      html: renderPasswordResetEmail(opts.link, footerLinks),
    },
    { purpose: "password_reset" }
  );
}

export async function dispatchStoreCampaignEmail(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  return dispatchEmail(
    {
      from: fromAddress(),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    },
    { purpose: "store_campaign", surface: "admin" }
  );
}

export async function sendStoreWaitlistWelcomeEmail(opts: {
  to: string;
  firstName?: string | null;
}): Promise<EmailSendResult> {
  const footerLinks = await getEmailFooterLinks();
  const { subject, html } = renderStoreCampaignEmail("waitlist_welcome", footerLinks, {
    firstName: opts.firstName,
  });
  return dispatchEmail(
    { from: fromAddress(), to: opts.to, subject, html },
    { purpose: "waitlist_welcome" }
  );
}

export async function sendStoreCampaignPreview(opts: {
  to: string;
  campaignType: WaitlistCampaignType;
  customSubject?: string;
  customHtml?: string;
}): Promise<EmailSendResult> {
  const footerLinks = await getEmailFooterLinks();
  const { subject, html } = renderStoreCampaignEmail(opts.campaignType, footerLinks, {
    customSubject: opts.customSubject,
    customHtml: opts.customHtml,
  });
  return dispatchEmail(
    { from: fromAddress(), to: opts.to, subject, html },
    { purpose: "campaign_preview", surface: "admin" }
  );
}

export { STORE_CAMPAIGN_SUBJECTS };

export async function sendNewsletterWelcomeEmail(opts: { to: string }): Promise<EmailSendResult> {
  const footerLinks = await getEmailFooterLinks();
  return dispatchEmail(
    {
      from: fromAddress(),
      to: opts.to,
      subject: "Welcome to O & I Label",
      html: renderNewsletterWelcomeEmail(footerLinks),
    },
    { purpose: "newsletter_welcome" }
  );
}

export async function sendRestockAvailableEmail(opts: {
  to: string;
  productName: string;
  productImageUrl: string;
  productUrl: string;
  unsubscribeUrl: string;
}): Promise<EmailSendResult> {
  const footerLinks = await getEmailFooterLinks();
  return dispatchEmail(
    {
      from: fromAddress(),
      to: opts.to,
      subject: restockAvailableEmailSubject(opts.productName),
      html: renderRestockAvailableEmail(
        {
          productName: opts.productName,
          productImageUrl: opts.productImageUrl,
          productUrl: opts.productUrl,
          unsubscribeUrl: opts.unsubscribeUrl,
        },
        footerLinks
      ),
    },
    { purpose: "restock_available", category: "restock", surface: "admin" }
  );
}

export async function sendOrderStatusEmail(opts: {
  to: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string | null;
  orderId?: string;
}): Promise<EmailSendResult> {
  const footerLinks = await getEmailFooterLinks();
  const copy = orderStatusEmailCopy(opts.status);
  let html: string;
  const subject = `${copy.subject} — ${opts.orderNumber}`;

  if (opts.orderId) {
    try {
      const service = createServiceRoleClient();
      const ctx = await fetchOrderEmailContext(service, opts.orderId);
      if (ctx) {
        html = renderOrderStatusEmail(ctx, opts.status, footerLinks, opts.trackingNumber);
        return dispatchEmail(
          { from: fromAddress(), to: opts.to, subject, html },
          { purpose: "order_status", surface: "admin" }
        );
      }
    } catch (e) {
      console.warn("Order status email context fetch failed:", e);
    }
  }

  html = renderOrderStatusEmailFallback(
    {
      orderNumber: opts.orderNumber,
      status: opts.status,
      trackingNumber: opts.trackingNumber,
      email: opts.to,
    },
    footerLinks
  );

  return dispatchEmail(
    { from: fromAddress(), to: opts.to, subject, html },
    { purpose: "order_status", surface: "admin" }
  );
}
