import { Resend } from "resend";

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
}): Promise<EmailSendResult> {
  return dispatchEmail({
    from: fromAddress(),
    to: opts.to,
    subject: `Order confirmed — ${opts.orderNumber}`,
    html: `<p>Thank you for shopping with O &amp; I Label.</p>
      <p>Order <strong>${opts.orderNumber}</strong></p>
      <p>Total: GHS ${opts.totalGhs.toFixed(2)}</p>`,
  });
}

export async function sendPasswordResetEmail(opts: { to: string; link: string }): Promise<EmailSendResult> {
  return dispatchEmail({
    from: fromAddress(),
    to: opts.to,
    subject: "Reset your password",
    html: `<p>Reset your password:</p><p><a href="${opts.link}">${opts.link}</a></p>`,
  });
}

export async function sendNewsletterWelcomeEmail(opts: { to: string }): Promise<EmailSendResult> {
  return dispatchEmail({
    from: fromAddress(),
    to: opts.to,
    subject: "You're on the list — O & I Label",
    html: `<p>Thanks for subscribing.</p>
      <p>You'll hear from us with new arrivals, offers, and style notes by <strong>email</strong>.</p>
      <p>For <strong>SMS/WhatsApp promos</strong>, we saved the number you provided for occasional messages (you can opt out anytime when we include an opt-out in those texts).</p>
      <p>— O &amp; I Label</p>`,
  });
}

const statusLabels: Record<string, string> = {
  pending: "pending payment",
  paid: "paid — we received your payment",
  processing: "being prepared",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "refunded",
};

export async function sendOrderStatusEmail(opts: {
  to: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string | null;
}): Promise<EmailSendResult> {
  const label = statusLabels[opts.status] ?? opts.status;
  const trackingLine = opts.trackingNumber
    ? `<p>Tracking number: <strong>${opts.trackingNumber}</strong></p>`
    : "";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    "https://www.oandilabel.com";
  const trackLine = `<p><a href="${baseUrl}/track-order">Track your order</a></p>`;

  return dispatchEmail({
    from: fromAddress(),
    to: opts.to,
    subject: `Order update — ${opts.orderNumber}`,
    html: `<p>Hello,</p>
      <p>Your O &amp; I Label order <strong>${opts.orderNumber}</strong> is now <strong>${label}</strong>.</p>
      ${trackingLine}
      ${trackLine}
      <p>Thank you for shopping with us.</p>`,
  });
}
