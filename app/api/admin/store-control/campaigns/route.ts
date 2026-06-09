import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { WAITLIST_CAMPAIGN_TYPES } from "@/lib/store-control/constants";
import { listRecentCampaigns, sendStoreEmailCampaign } from "@/lib/store-control/campaigns";
import type { WaitlistCampaignType } from "@/lib/store-control/constants";

function isCampaignType(v: unknown): v is WaitlistCampaignType {
  return typeof v === "string" && (WAITLIST_CAMPAIGN_TYPES as readonly string[]).includes(v);
}

export async function GET() {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const campaigns = await listRecentCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    action?: unknown;
    campaignType?: unknown;
    customSubject?: unknown;
    customHtml?: unknown;
    previewEmail?: unknown;
  };

  const action = b.action === "preview" ? "preview" : "send";
  const campaignType = b.campaignType;
  if (!isCampaignType(campaignType)) {
    return NextResponse.json({ error: "Invalid campaign type" }, { status: 400 });
  }

  const result = await sendStoreEmailCampaign({
    campaignType,
    createdBy: authz.user?.id ?? null,
    customSubject: typeof b.customSubject === "string" ? b.customSubject : undefined,
    customHtml: typeof b.customHtml === "string" ? b.customHtml : undefined,
    previewOnly: action === "preview",
    previewEmail: typeof b.previewEmail === "string" ? b.previewEmail : undefined,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
