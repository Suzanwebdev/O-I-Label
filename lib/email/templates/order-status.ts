import { EMAIL_BRAND, type EmailFooterLinks } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/orders/format-address";
import type { OrderEmailContext } from "@/lib/email/fetch-order-email-context";
import { orderStatusEmailCopy } from "@/lib/email/templates/copy";
import { wrapTransactionalEmail } from "@/lib/email/templates/layout";
import {
  emailCtaButton,
  emailHeroBlock,
  emailLineItemsBlock,
  emailOrderMetaCard,
  emailOrderTotalsBlock,
  emailTrackingBlock,
  formatEmailDate,
} from "@/lib/email/templates/parts";

export function renderOrderStatusEmail(
  ctx: OrderEmailContext,
  status: string,
  footerLinks: EmailFooterLinks,
  trackingNumber?: string | null
): string {
  const copy = orderStatusEmailCopy(status);
  const links = footerLinks;
  const trackUrl = `${links.trackOrder}?order=${encodeURIComponent(ctx.orderNumber)}&email=${encodeURIComponent(ctx.email)}`;
  const ctaHref =
    status === "delivered"
      ? links.shop
      : status === "cancelled" || status === "refunded"
        ? links.contact
        : trackUrl;

  const tracking =
    trackingNumber?.trim() && (status === "shipped" || status === "delivered")
      ? emailTrackingBlock(trackingNumber.trim())
      : "";

  const content = `
    ${emailHeroBlock({
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      greeting: ctx.customerName ? `Dear ${ctx.customerName},` : undefined,
      body: copy.body,
    })}
    ${emailOrderMetaCard({
      orderNumber: ctx.orderNumber,
      placedAt: formatEmailDate(ctx.createdAt),
    })}
    ${tracking}
    ${emailLineItemsBlock(ctx.items)}
    ${emailOrderTotalsBlock({
      subtotalGhs: ctx.subtotalGhs,
      shippingGhs: ctx.shippingGhs,
      taxGhs: ctx.taxGhs,
      discountGhs: ctx.discountGhs,
      totalGhs: ctx.totalGhs,
    })}
    ${emailCtaButton(copy.ctaLabel, ctaHref)}
    <p style="margin:0;font-size:13px;line-height:1.65;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">Questions about your order? We are happy to help at <a href="mailto:${escapeHtml(links.supportEmail)}" style="color:${EMAIL_BRAND.colors.text};text-decoration:underline;" class="email-text">${escapeHtml(links.supportEmail)}</a>.</p>
  `;

  return wrapTransactionalEmail({
    title: `${copy.subject} — ${ctx.orderNumber}`,
    preheader: `${copy.headline} — Order ${ctx.orderNumber}`,
    contentHtml: content,
    footerLinks: links,
  });
}

export function renderOrderStatusEmailFallback(
  opts: {
    orderNumber: string;
    status: string;
    trackingNumber?: string | null;
    email?: string;
  },
  footerLinks: EmailFooterLinks
): string {
  const copy = orderStatusEmailCopy(opts.status);
  const links = footerLinks;
  const trackUrl = opts.email
    ? `${links.trackOrder}?order=${encodeURIComponent(opts.orderNumber)}&email=${encodeURIComponent(opts.email)}`
    : links.trackOrder;
  const tracking = opts.trackingNumber?.trim() ? emailTrackingBlock(opts.trackingNumber.trim()) : "";

  const content = `
    ${emailHeroBlock({ eyebrow: copy.eyebrow, headline: copy.headline, body: copy.body })}
    ${emailOrderMetaCard({ orderNumber: opts.orderNumber, placedAt: "—" })}
    ${tracking}
    ${emailCtaButton(copy.ctaLabel, trackUrl)}
  `;

  return wrapTransactionalEmail({
    title: `${copy.subject} — ${opts.orderNumber}`,
    preheader: `Update for order ${opts.orderNumber}`,
    contentHtml: content,
    footerLinks: links,
  });
}
