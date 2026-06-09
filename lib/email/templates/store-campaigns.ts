import { EMAIL_BRAND, type EmailFooterLinks } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/orders/format-address";
import { wrapTransactionalEmail } from "@/lib/email/templates/layout";
import { emailCtaButton, emailHeroBlock } from "@/lib/email/templates/parts";
import {
  STORE_CAMPAIGN_SUBJECTS,
  type WaitlistCampaignType,
} from "@/lib/store-control/constants";

export { STORE_CAMPAIGN_SUBJECTS };

type CampaignContent = { eyebrow: string; headline: string; body: string; cta: string };

function contentFor(type: WaitlistCampaignType, firstName?: string | null): CampaignContent {
  const name = firstName?.trim() ? firstName.trim() : "there";
  switch (type) {
    case "waitlist_welcome":
      return {
        eyebrow: "Private list",
        headline: "Welcome to the list",
        body: `Dear ${name}, thank you for joining the O & I Label private list. You'll receive first access to new edits, presale previews, and launch-day priority — delivered with the quiet elegance you expect from us.`,
        cta: "Explore the boutique",
      };
    case "presale_opening":
      return {
        eyebrow: "Early access",
        headline: "Your early access starts now",
        body: `${name}, the presale preview is open. Explore the collection, save your favourites, and prepare for launch — purchasing opens when the countdown ends.`,
        cta: "Shop the presale preview",
      };
    case "launch_day":
      return {
        eyebrow: "Now live",
        headline: "The collection is live",
        body: `${name}, the wait is over. Our latest edit is now available to shop — curated pieces designed to be worn, loved, and remembered.`,
        cta: "Shop the collection",
      };
    case "store_reopening":
      return {
        eyebrow: "We're back",
        headline: "The boutique has reopened",
        body: `${name}, we're delighted to welcome you back. Explore refreshed arrivals and continue where you left off.`,
        cta: "Return to the boutique",
      };
    case "maintenance_complete":
      return {
        eyebrow: "Open again",
        headline: "The boutique is open again",
        body: `${name}, our brief pause is complete. The O & I Label storefront is ready for you once more.`,
        cta: "Shop now",
      };
    default:
      return {
        eyebrow: "O & I Label",
        headline: "A note from the atelier",
        body: `${name}, we wanted to share something special with you.`,
        cta: "Visit the boutique",
      };
  }
}

export function renderStoreCampaignEmail(
  type: WaitlistCampaignType,
  footerLinks: EmailFooterLinks,
  opts?: { firstName?: string | null; customHtml?: string; customSubject?: string }
): { subject: string; html: string } {
  const copy = contentFor(type, opts?.firstName);
  const subject =
    type === "custom" && opts?.customSubject?.trim()
      ? opts.customSubject.trim()
      : STORE_CAMPAIGN_SUBJECTS[type];

  const bodyBlock =
    type === "custom" && opts?.customHtml?.trim()
      ? `<div style="margin:0 0 28px 0;font-size:15px;line-height:1.7;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">${opts.customHtml}</div>`
      : "";

  const content = `
    ${emailHeroBlock({
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      body: type === "custom" && opts?.customHtml ? "" : copy.body,
    })}
    ${bodyBlock}
    ${emailCtaButton(copy.cta, footerLinks.shop)}
    <p style="margin:0;font-size:13px;line-height:1.65;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">With love, <span style="color:${EMAIL_BRAND.colors.text};" class="email-text">${escapeHtml(EMAIL_BRAND.name)}</span></p>
  `;

  return {
    subject,
    html: wrapTransactionalEmail({
      title: subject,
      preheader: copy.body.slice(0, 120),
      contentHtml: content,
      footerLinks,
    }),
  };
}
