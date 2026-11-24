import { EMAIL_BRAND, type EmailFooterLinks } from "@/lib/email/brand";
import { wrapTransactionalEmail } from "@/lib/email/templates/layout";
import { escapeHtml } from "@/lib/orders/format-address";

function plainTextToHtml(message: string): string {
  return escapeHtml(message)
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").join("<br />");
      return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">${lines}</p>`;
    })
    .join("");
}

export function renderCustomerMessageEmail(opts: {
  subject: string;
  message: string;
  firstName?: string | null;
  footerLinks: EmailFooterLinks;
}): { subject: string; html: string } {
  const subject = opts.subject.trim() || "A note from O & I Label";
  const name = opts.firstName?.trim();
  const greeting = name
    ? `<p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:${EMAIL_BRAND.colors.text};" class="email-text">Hi ${escapeHtml(name)},</p>`
    : "";

  const content = `
    ${greeting}
    ${plainTextToHtml(opts.message)}
    <p style="margin:28px 0 0 0;font-size:13px;line-height:1.65;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">With love, <span style="color:${EMAIL_BRAND.colors.text};" class="email-text">${escapeHtml(EMAIL_BRAND.name)}</span></p>
  `;

  return {
    subject,
    html: wrapTransactionalEmail({
      title: subject,
      preheader: opts.message.trim().slice(0, 120),
      contentHtml: content,
      footerLinks: opts.footerLinks,
    }),
  };
}
