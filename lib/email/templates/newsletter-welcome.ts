import { EMAIL_BRAND, type EmailFooterLinks } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/orders/format-address";
import { wrapTransactionalEmail } from "@/lib/email/templates/layout";
import { emailCtaButton, emailHeroBlock } from "@/lib/email/templates/parts";

export function renderNewsletterWelcomeEmail(footerLinks: EmailFooterLinks): string {
  const links = footerLinks;
  const content = `
    ${emailHeroBlock({
      eyebrow: "Welcome",
      headline: "You are on the list",
      body: "Thank you for joining O & I Label. Expect curated new arrivals, exclusive offers, and editorial style notes delivered with intention — never noise.",
    })}
    ${emailCtaButton("Explore the collection", links.shop)}
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">If you shared your mobile number, we may occasionally send SMS or WhatsApp updates about promotions. You can opt out anytime when those messages include an opt-out option.</p>
    <p style="margin:0;font-size:13px;line-height:1.65;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">Follow us on <a href="${escapeHtml(links.instagram)}" target="_blank" rel="noopener noreferrer" style="color:${EMAIL_BRAND.colors.text};text-decoration:underline;" class="email-text">Instagram</a> for daily inspiration.</p>
  `;

  return wrapTransactionalEmail({
    title: "Welcome to O & I Label",
    preheader: "Welcome to O & I Label — new arrivals and style notes await.",
    contentHtml: content,
    footerLinks: links,
  });
}
