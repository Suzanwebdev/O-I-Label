import { Resend } from "resend";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendOrderConfirmationEmail(opts: {
  to: string;
  orderNumber: string;
  totalGhs: number;
}) {
  const resend = client();
  if (!resend) {
    console.warn("RESEND_API_KEY missing; skip order email");
    return { skipped: true as const };
  }
  const from = process.env.RESEND_FROM ?? "O & I Label <onboarding@resend.dev>";
  await resend.emails.send({
    from,
    to: opts.to,
    subject: `Order confirmed — ${opts.orderNumber}`,
    html: `<p>Thank you for shopping with O &amp; I Label.</p>
      <p>Order <strong>${opts.orderNumber}</strong></p>
      <p>Total: GHS ${opts.totalGhs.toFixed(2)}</p>`,
  });
  return { sent: true as const };
}

export async function sendPasswordResetEmail(opts: { to: string; link: string }) {
  const resend = client();
  if (!resend) return { skipped: true as const };
  const from = process.env.RESEND_FROM ?? "O & I Label <onboarding@resend.dev>";
  await resend.emails.send({
    from,
    to: opts.to,
    subject: "Reset your password",
    html: `<p>Reset your password:</p><p><a href="${opts.link}">${opts.link}</a></p>`,
  });
  return { sent: true as const };
}

export async function sendNewsletterWelcomeEmail(opts: { to: string }) {
  const resend = client();
  if (!resend) {
    return { skipped: true as const };
  }
  const from = process.env.RESEND_FROM ?? "O & I Label <onboarding@resend.dev>";
  await resend.emails.send({
    from,
    to: opts.to,
    subject: "You're on the list — O & I Label",
    html: `<p>Thanks for subscribing.</p>
      <p>You'll hear from us with new arrivals, offers, and style notes by <strong>email</strong>.</p>
      <p>For <strong>SMS/WhatsApp promos</strong>, we saved the number you provided for occasional messages (you can opt out anytime when we include an opt-out in those texts).</p>
      <p>— O &amp; I Label</p>`,
  });
  return { sent: true as const };
}

export async function sendOrderStatusEmail(opts: {
  to: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string | null;
}) {
  const resend = client();
  if (!resend) {
    console.warn("RESEND_API_KEY missing; skip status email");
    return { skipped: true as const };
  }
  const from = process.env.RESEND_FROM ?? "O & I Label <onboarding@resend.dev>";
  const trackingLine = opts.trackingNumber
    ? `<p>Tracking: <strong>${opts.trackingNumber}</strong></p>`
    : "";
  await resend.emails.send({
    from,
    to: opts.to,
    subject: `Order update — ${opts.orderNumber}`,
    html: `<p>Your order <strong>${opts.orderNumber}</strong> is now <strong>${opts.status}</strong>.</p>${trackingLine}`,
  });
  return { sent: true as const };
}
