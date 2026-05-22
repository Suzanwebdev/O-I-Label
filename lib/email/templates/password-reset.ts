import { EMAIL_BRAND, type EmailFooterLinks } from "@/lib/email/brand";
import { wrapTransactionalEmail } from "@/lib/email/templates/layout";
import { emailCtaButton, emailHeroBlock } from "@/lib/email/templates/parts";

export function renderPasswordResetEmail(link: string, footerLinks: EmailFooterLinks): string {
  const links = footerLinks;
  const content = `
    ${emailHeroBlock({
      eyebrow: "Account",
      headline: "Reset your password",
      body: "We received a request to reset the password for your O & I Label account. Tap the button below to choose a new password. This link is for you only — if you did not request it, you can safely ignore this email.",
    })}
    ${emailCtaButton("Reset password", link)}
    <p style="margin:0 0 12px 0;font-size:12px;line-height:1.6;color:${EMAIL_BRAND.colors.textMuted};word-break:break-all;" class="email-muted">Or copy this link:<br /><a href="${link}" style="color:${EMAIL_BRAND.colors.text};" class="email-text">${link}</a></p>
    <p style="margin:0;font-size:13px;line-height:1.65;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">Need help? Contact <a href="mailto:${links.supportEmail}" style="text-decoration:underline;color:${EMAIL_BRAND.colors.text};" class="email-text">${links.supportEmail}</a>.</p>
  `;

  return wrapTransactionalEmail({
    title: "Reset your password — O & I Label",
    preheader: "Reset your O & I Label account password.",
    contentHtml: content,
    footerLinks: links,
  });
}
