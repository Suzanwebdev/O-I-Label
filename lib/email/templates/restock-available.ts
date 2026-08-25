import { EMAIL_BRAND, type EmailFooterLinks } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/orders/format-address";
import { wrapTransactionalEmail } from "@/lib/email/templates/layout";
import { emailCtaButton, emailHeroBlock } from "@/lib/email/templates/parts";

export type RestockAvailableEmailContent = {
  productName: string;
  productImageUrl: string;
  productUrl: string;
  unsubscribeUrl: string;
};

export function renderRestockAvailableEmail(
  content: RestockAvailableEmailContent,
  footerLinks: EmailFooterLinks
): string {
  const name = content.productName.trim() || "This piece";
  const contentHtml = `
    ${emailHeroBlock({
      eyebrow: "Back in stock",
      headline: "It's available again",
      body: `${name} is available again. Shop now while sizes last.`,
    })}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 24px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(content.productUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
            <img src="${escapeHtml(content.productImageUrl)}" alt="${escapeHtml(name)}" width="280" style="display:block;width:100%;max-width:280px;height:auto;border:1px solid ${EMAIL_BRAND.colors.border};background-color:#f0ebe4;" />
          </a>
          <p style="margin:12px 0 0 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:18px;line-height:1.35;color:${EMAIL_BRAND.colors.text};" class="email-text">${escapeHtml(name)}</p>
        </td>
      </tr>
    </table>
    ${emailCtaButton("Shop now", content.productUrl)}
    <p style="margin:0;font-size:12px;line-height:1.65;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">
      You asked to be notified when this piece returned.
      <a href="${escapeHtml(content.unsubscribeUrl)}" style="color:${EMAIL_BRAND.colors.text};text-decoration:underline;" class="email-text">Unsubscribe from this alert</a>.
    </p>
  `;

  return wrapTransactionalEmail({
    title: `${name} is back — O & I Label`,
    preheader: `${name} is available again at O & I Label.`,
    contentHtml,
    footerLinks,
  });
}

export function restockAvailableEmailSubject(productName: string): string {
  const name = productName.trim() || "Your piece";
  return `${name} is back in stock — O & I Label`;
}
