import { Resend } from "resend";
import { fetchOrderEmailContext } from "@/lib/email/fetch-order-email-context";
import {
  renderNewsletterWelcomeEmail,
} from "@/lib/email/templates/newsletter-welcome";
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
import { createServiceRoleClient } from "@/lib/supabase/server";

export type EmailSendResult =
  | { sent: true; id?: string }
  | { skipped: true; reason: string }
  | { sent: false; error: string };

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

async function dispatchEmail(payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const resend = client();
  if (!resend) {
    return { skipped: true, reason: "RESEND_API_KEY not configured" };
  }

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.warn("Resend send failed:", error.message);
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
  let html: string;
  let subject: string;

  if (opts.orderId) {
    try {
      const service = createServiceRoleClient();
      const ctx = await fetchOrderEmailContext(service, opts.orderId);
      if (ctx) {
        const copy = orderConfirmationCopy(ctx.customerName);
        html = renderOrderConfirmationEmail(ctx);
        subject = copy.subject(ctx.orderNumber);
        return dispatchEmail({ from: fromAddress(), to: opts.to, subject, html });
      }
    } catch (e) {
      console.warn("Order confirmation email context fetch failed:", e);
    }
  }

  const copy = orderConfirmationCopy(null);
  html = renderOrderConfirmationEmailFallback({
    orderNumber: opts.orderNumber,
    totalGhs: opts.totalGhs,
  });
  subject = copy.subject(opts.orderNumber);

  return dispatchEmail({ from: fromAddress(), to: opts.to, subject, html });
}

export async function sendPasswordResetEmail(opts: { to: string; link: string }): Promise<EmailSendResult> {
  return dispatchEmail({
    from: fromAddress(),
    to: opts.to,
    subject: "Reset your password — O & I Label",
    html: renderPasswordResetEmail(opts.link),
  });
}

export async function sendNewsletterWelcomeEmail(opts: { to: string }): Promise<EmailSendResult> {
  return dispatchEmail({
    from: fromAddress(),
    to: opts.to,
    subject: "Welcome to O & I Label",
    html: renderNewsletterWelcomeEmail(),
  });
}

export async function sendOrderStatusEmail(opts: {
  to: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string | null;
  orderId?: string;
}): Promise<EmailSendResult> {
  const copy = orderStatusEmailCopy(opts.status);
  let html: string;
  const subject = `${copy.subject} — ${opts.orderNumber}`;

  if (opts.orderId) {
    try {
      const service = createServiceRoleClient();
      const ctx = await fetchOrderEmailContext(service, opts.orderId);
      if (ctx) {
        html = renderOrderStatusEmail(ctx, opts.status, opts.trackingNumber);
        return dispatchEmail({ from: fromAddress(), to: opts.to, subject, html });
      }
    } catch (e) {
      console.warn("Order status email context fetch failed:", e);
    }
  }

  html = renderOrderStatusEmailFallback({
    orderNumber: opts.orderNumber,
    status: opts.status,
    trackingNumber: opts.trackingNumber,
    email: opts.to,
  });

  return dispatchEmail({ from: fromAddress(), to: opts.to, subject, html });
}
