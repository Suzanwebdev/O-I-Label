import { getEmailFooterLinks } from "@/lib/email/brand";
import { dispatchStoreCampaignEmail } from "@/lib/email/resend";
import { renderStoreCampaignEmail } from "@/lib/email/templates/store-campaigns";
import type { WaitlistCampaignType } from "@/lib/store-control/constants";
import { listWaitlistEmailsForCampaign } from "@/lib/store-control/waitlist";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type CampaignSendResult = {
  campaignId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: "completed" | "failed";
};

export async function sendStoreEmailCampaign(opts: {
  campaignType: WaitlistCampaignType;
  createdBy?: string | null;
  customSubject?: string;
  customHtml?: string;
  previewOnly?: boolean;
  previewEmail?: string;
}): Promise<
  | { preview: true; subject: string; html: string }
  | { preview: false; result: CampaignSendResult }
  | { error: string }
> {
  const footerLinks = await getEmailFooterLinks();
  const rendered = renderStoreCampaignEmail(opts.campaignType, footerLinks, {
    customHtml: opts.customHtml,
    customSubject: opts.customSubject,
  });

  if (opts.previewOnly) {
    return { preview: true, subject: rendered.subject, html: rendered.html };
  }

  const recipients = opts.previewEmail?.trim()
    ? [opts.previewEmail.trim()]
    : await listWaitlistEmailsForCampaign();

  if (!recipients.length) {
    return { error: "No waitlist subscribers to notify." };
  }

  const service = createServiceRoleClient();
  const { data: campaign, error: insertErr } = await service
    .from("store_email_campaigns")
    .insert({
      campaign_type: opts.campaignType,
      subject: rendered.subject,
      recipient_count: recipients.length,
      status: "sending",
      created_by: opts.createdBy ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !campaign) {
    return { error: insertErr?.message ?? "Could not create campaign record" };
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const to of recipients) {
    const res = await dispatchStoreCampaignEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
    });
    if ("sent" in res && res.sent) sentCount += 1;
    else failedCount += 1;
  }

  const status = failedCount === recipients.length ? "failed" : "completed";
  await service
    .from("store_email_campaigns")
    .update({
      sent_count: sentCount,
      failed_count: failedCount,
      status,
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);

  return {
    preview: false,
    result: {
      campaignId: campaign.id,
      recipientCount: recipients.length,
      sentCount,
      failedCount,
      status: status as "completed" | "failed",
    },
  };
}

export async function listRecentCampaigns(limit = 20) {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("store_email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
