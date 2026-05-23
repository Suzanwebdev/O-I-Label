import { EMAIL_BRAND } from "@/lib/email/brand";
import type { OrderEmailLineItem } from "@/lib/email/fetch-order-email-context";
import { escapeHtml } from "@/lib/orders/format-address";

const { colors } = EMAIL_BRAND;

export function emailHeroBlock(opts: {
  eyebrow: string;
  headline: string;
  greeting?: string;
  body: string;
}): string {
  const greeting = opts.greeting
    ? `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:${colors.text};" class="email-text">${escapeHtml(opts.greeting)}</p>`
    : "";
  return `
    <p style="margin:0 0 8px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${colors.accent};">${escapeHtml(opts.eyebrow)}</p>
    <h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;font-weight:400;line-height:1.25;color:${colors.text};" class="email-text">${escapeHtml(opts.headline)}</h1>
    ${greeting}
    <p style="margin:0 0 28px 0;font-size:15px;line-height:1.7;color:${colors.textMuted};" class="email-muted">${escapeHtml(opts.body)}</p>`;
}

export function emailCtaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 32px 0;">
  <tr>
    <td align="center" style="border-radius:2px;background-color:${colors.ctaBg};" class="email-cta">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(href)}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="0%" strokecolor="${colors.ctaBg}" fillcolor="${colors.ctaBg}">
        <w:anchorlock/>
        <center style="color:${colors.ctaText};font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(label)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;color:${colors.ctaText};background-color:${colors.ctaBg};border-radius:2px;" class="email-cta">${escapeHtml(label)}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

export function emailOrderMetaCard(opts: { orderNumber: string; placedAt: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 24px 0;background-color:#faf8f5;border:1px solid ${colors.border};" class="email-summary">
  <tr>
    <td style="padding:18px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${colors.textMuted};" class="email-muted">Order</td>
          <td align="right" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${colors.textMuted};" class="email-muted">Placed</td>
        </tr>
        <tr>
          <td style="padding-top:6px;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${colors.text};" class="email-text">${escapeHtml(opts.orderNumber)}</td>
          <td align="right" style="padding-top:6px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${colors.text};" class="email-text">${escapeHtml(opts.placedAt)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function lineItemMeta(item: OrderEmailLineItem): string {
  const parts: string[] = [];
  if (item.size) parts.push(`Size ${item.size}`);
  if (item.color) parts.push(item.color);
  parts.push(`Qty ${item.quantity}`);
  return parts.join(" · ");
}

export function emailLineItemsBlock(items: OrderEmailLineItem[]): string {
  if (!items.length) return "";
  const rows = items
    .map(
      (item) => `<tr>
      <td style="padding:16px 0;border-bottom:1px solid ${colors.border};" class="email-item-row email-border">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="72" valign="top" style="width:72px;padding-right:14px;">
              <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" width="64" height="80" style="display:block;width:64px;height:80px;object-fit:cover;background-color:#f0ebe4;border:1px solid ${colors.border};" />
            </td>
            <td valign="top">
              <p style="margin:0 0 6px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.4;color:${colors.text};" class="email-text">${escapeHtml(item.name)}</p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:${colors.textMuted};" class="email-muted">${escapeHtml(lineItemMeta(item))}</p>
            </td>
            <td valign="top" align="right" style="padding-left:8px;white-space:nowrap;">
              <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${colors.text};" class="email-text">GH&#8373; ${item.lineTotalGhs.toFixed(2)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 8px 0;">
  <tr>
    <td style="padding-bottom:10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${colors.textMuted};" class="email-muted">Your pieces</td>
  </tr>
  ${rows}
</table>`;
}

export function emailOrderTotalsBlock(opts: {
  subtotalGhs: number;
  shippingGhs: number;
  taxGhs: number;
  discountGhs: number;
  discountCode?: string | null;
  totalGhs: number;
}): string {
  const row = (label: string, value: string, bold = false) => {
    const weight = bold ? "600" : "400";
    const size = bold ? "16px" : "13px";
    const color = bold ? colors.text : colors.textMuted;
    const cls = bold ? "email-text" : "email-muted";
    return `<tr>
      <td style="padding:6px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:${size};color:${color};" class="${cls}">${escapeHtml(label)}</td>
      <td align="right" style="padding:6px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:${size};font-weight:${weight};color:${colors.text};" class="email-text">${value}</td>
    </tr>`;
  };

  const discountLabel =
    opts.discountGhs > 0
      ? opts.discountCode
        ? `Promo (${opts.discountCode})`
        : "Discount"
      : "";
  const discountRow =
    opts.discountGhs > 0
      ? row(discountLabel, `&minus; GH&#8373; ${opts.discountGhs.toFixed(2)}`)
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:16px 0 0 0;padding:18px 20px;background-color:#faf8f5;border:1px solid ${colors.border};" class="email-summary email-border">
  <tr><td style="padding:18px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Subtotal", `GH&#8373; ${opts.subtotalGhs.toFixed(2)}`)}
      ${row("Shipping", `GH&#8373; ${opts.shippingGhs.toFixed(2)}`)}
      ${opts.taxGhs > 0 ? row("Tax", `GH&#8373; ${opts.taxGhs.toFixed(2)}`) : ""}
      ${discountRow}
      <tr><td colspan="2" style="padding:8px 0;border-top:1px solid ${colors.border};" class="email-border"></td></tr>
      ${row("Total", `GH&#8373; ${opts.totalGhs.toFixed(2)}`, true)}
    </table>
  </td></tr>
</table>`;
}

export function emailTrackingBlock(trackingNumber: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 24px 0;border:1px solid ${colors.border};" class="email-border">
  <tr>
    <td style="padding:16px 20px;">
      <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${colors.textMuted};" class="email-muted">Tracking number</p>
      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:17px;letter-spacing:0.04em;color:${colors.text};" class="email-text">${escapeHtml(trackingNumber)}</p>
    </td>
  </tr>
</table>`;
}

export function formatEmailDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
