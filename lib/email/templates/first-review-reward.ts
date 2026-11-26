import { EMAIL_BRAND, type EmailFooterLinks } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/orders/format-address";
import { wrapTransactionalEmail } from "@/lib/email/templates/layout";
import { emailCtaButton, emailHeroBlock } from "@/lib/email/templates/parts";

export function firstReviewRewardEmailSubject(): string {
  return "Thank you — here's 10% off your next order";
}

export function renderFirstReviewRewardEmail(opts: {
  firstName?: string | null;
  code: string;
  footerLinks: EmailFooterLinks;
}): { subject: string; html: string } {
  const subject = firstReviewRewardEmailSubject();
  const name = opts.firstName?.trim();
  const greeting = name
    ? `Thank you, ${name}`
    : "Thank you for your first review";

  const content = `
    ${emailHeroBlock({
      eyebrow: "A gift for you",
      headline: greeting,
      body: "We're so glad you shared your experience with O & I Label. As a thank-you for your first review, enjoy 10% off your next order with the personal code below.",
    })}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 24px 0;background-color:#faf8f5;border:1px solid ${EMAIL_BRAND.colors.border};" class="email-summary email-border">
      <tr>
        <td style="padding:20px 22px;text-align:center;">
          <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">Your code</p>
          <p style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:0.08em;color:${EMAIL_BRAND.colors.text};" class="email-text">${escapeHtml(opts.code)}</p>
          <p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">10% off your next order</p>
        </td>
      </tr>
    </table>
    ${emailCtaButton("Shop the collection", opts.footerLinks.shop)}
    <p style="margin:0;font-size:13px;line-height:1.65;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">Enter this code at checkout on your next order. Single use.</p>
  `;

  return {
    subject,
    html: wrapTransactionalEmail({
      title: subject,
      preheader: `Your personal 10% code: ${opts.code}`,
      contentHtml: content,
      footerLinks: opts.footerLinks,
    }),
  };
}
