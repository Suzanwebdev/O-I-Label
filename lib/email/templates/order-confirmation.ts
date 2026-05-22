import { EMAIL_BRAND, emailFooterLinks } from "@/lib/email/brand";
import type { OrderEmailContext } from "@/lib/email/fetch-order-email-context";
import { orderConfirmationCopy } from "@/lib/email/templates/copy";
import { wrapTransactionalEmail } from "@/lib/email/templates/layout";
import {
  emailCtaButton,
  emailHeroBlock,
  emailLineItemsBlock,
  emailOrderMetaCard,
  emailOrderTotalsBlock,
  formatEmailDate,
} from "@/lib/email/templates/parts";

export function renderOrderConfirmationEmail(ctx: OrderEmailContext): string {
  const copy = orderConfirmationCopy(ctx.customerName);
  const links = emailFooterLinks();
  const trackUrl = `${links.trackOrder}?order=${encodeURIComponent(ctx.orderNumber)}&email=${encodeURIComponent(ctx.email)}`;

  const content = `
    ${emailHeroBlock({
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      greeting: copy.greeting,
      body: copy.body,
    })}
    ${emailOrderMetaCard({
      orderNumber: ctx.orderNumber,
      placedAt: formatEmailDate(ctx.createdAt),
    })}
    ${emailLineItemsBlock(ctx.items)}
    ${emailOrderTotalsBlock({
      subtotalGhs: ctx.subtotalGhs,
      shippingGhs: ctx.shippingGhs,
      taxGhs: ctx.taxGhs,
      discountGhs: ctx.discountGhs,
      totalGhs: ctx.totalGhs,
    })}
    ${emailCtaButton(copy.ctaLabel, trackUrl)}
    <p style="margin:0;font-size:13px;line-height:1.65;color:${EMAIL_BRAND.colors.textMuted};" class="email-muted">Need help? Reply to this email or visit our <a href="${links.contact}" style="color:${EMAIL_BRAND.colors.text};text-decoration:underline;" class="email-text">contact page</a>.</p>
  `;

  return wrapTransactionalEmail({
    title: copy.subject(ctx.orderNumber),
    preheader: `Your O & I Label order ${ctx.orderNumber} is confirmed.`,
    contentHtml: content,
  });
}

export function renderOrderConfirmationEmailFallback(opts: {
  orderNumber: string;
  totalGhs: number;
}): string {
  const copy = orderConfirmationCopy(null);
  const links = emailFooterLinks();
  const content = `
    ${emailHeroBlock({
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      greeting: copy.greeting,
      body: copy.body,
    })}
    ${emailOrderMetaCard({ orderNumber: opts.orderNumber, placedAt: formatEmailDate(new Date().toISOString()) })}
    ${emailOrderTotalsBlock({
      subtotalGhs: opts.totalGhs,
      shippingGhs: 0,
      taxGhs: 0,
      discountGhs: 0,
      totalGhs: opts.totalGhs,
    })}
    ${emailCtaButton(copy.ctaLabel, links.trackOrder)}
  `;
  return wrapTransactionalEmail({
    title: copy.subject(opts.orderNumber),
    preheader: `Order ${opts.orderNumber} confirmed.`,
    contentHtml: content,
  });
}
