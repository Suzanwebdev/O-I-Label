import { EMAIL_BRAND, type EmailFooterLinks } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/orders/format-address";

const { colors } = EMAIL_BRAND;

export type TransactionalEmailLayoutOpts = {
  preheader: string;
  title: string;
  contentHtml: string;
  footerLinks: EmailFooterLinks;
};

function preheaderHtml(text: string): string {
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(text)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;
}

function headerHtml(): string {
  const { siteUrl, name, tagline } = EMAIL_BRAND;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:36px 24px 28px 24px;">
      <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;color:${colors.text};" class="email-text">
        <span style="font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;letter-spacing:0.22em;font-weight:400;text-transform:uppercase;">${escapeHtml(name)}</span>
      </a>
      <p style="margin:10px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${colors.textMuted};" class="email-muted">${escapeHtml(tagline)}</p>
    </td>
  </tr>
</table>`;
}

function footerHtml(links: EmailFooterLinks): string {
  const year = new Date().getFullYear();
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px;">
  <tr>
    <td align="center" style="padding:28px 24px 36px 24px;border-top:1px solid ${colors.border};" class="email-border-top">
      <p style="margin:0 0 14px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${colors.textMuted};" class="email-muted">
        <a href="mailto:${escapeHtml(links.supportEmail)}" style="color:${colors.text};text-decoration:underline;" class="email-text">${escapeHtml(links.supportEmail)}</a>
      </p>
      <p style="margin:0 0 16px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.8;letter-spacing:0.06em;" class="email-muted">
        <a href="${escapeHtml(links.contact)}" style="color:${colors.textMuted};text-decoration:none;margin:0 8px;">Contact</a>
        <span style="color:${colors.border};">|</span>
        <a href="${escapeHtml(links.trackOrder)}" style="color:${colors.textMuted};text-decoration:none;margin:0 8px;">Track order</a>
        <span style="color:${colors.border};">|</span>
        <a href="${escapeHtml(links.returns)}" style="color:${colors.textMuted};text-decoration:none;margin:0 8px;">Returns</a>
        <span style="color:${colors.border};">|</span>
        <a href="${escapeHtml(links.instagram)}" target="_blank" rel="noopener noreferrer" style="color:${colors.textMuted};text-decoration:none;margin:0 8px;">Instagram</a>
      </p>
      <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${colors.textMuted};" class="email-muted">
        &copy; ${year} ${escapeHtml(EMAIL_BRAND.name)}
      </p>
    </td>
  </tr>
</table>`;
}

/** Email-safe shell with light/dark styles for Apple Mail, Gmail, and Outlook. */
export function wrapTransactionalEmail(opts: TransactionalEmailLayoutOpts): string {
  const darkStyles = `
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: ${colors.bgDark} !important; }
      .email-card { background-color: ${colors.cardDark} !important; }
      .email-text { color: ${colors.textDark} !important; }
      .email-muted { color: ${colors.textMutedDark} !important; }
      .email-border { border-color: ${colors.borderDark} !important; }
      .email-border-top { border-color: ${colors.borderDark} !important; }
      .email-summary { background-color: #252525 !important; }
      .email-cta { background-color: #f5f2ef !important; color: #1a1a1a !important; }
      .email-item-row { border-color: ${colors.borderDark} !important; }
    }
  `;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(opts.title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a { color: inherit; }
    ${darkStyles}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${colors.bg};" class="email-bg">
  ${preheaderHtml(opts.preheader)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${colors.bg};" class="email-bg">
    <tr>
      <td align="center" style="padding:0 12px 40px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${colors.card};border:1px solid ${colors.border};" class="email-card email-border">
              ${headerHtml()}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 32px 32px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${colors.text};" class="email-text">
                    ${opts.contentHtml}
                  </td>
                </tr>
              </table>
              ${footerHtml(opts.footerLinks)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
