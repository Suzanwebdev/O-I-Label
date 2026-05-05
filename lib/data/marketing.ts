import { createServiceRoleClient } from "@/lib/supabase/server";

export type MarketingChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type MarketingCampaign = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  channel_notes: string | null;
  checklist: MarketingChecklistItem[];
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  updated_at: string;
};

function parseChecklist(raw: unknown): MarketingChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MarketingChecklistItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!label) continue;
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : `item-${out.length}`;
    out.push({ id, label: label.slice(0, 500), done: Boolean(r.done) });
    if (out.length >= 40) break;
  }
  return out;
}

export async function listMarketingCampaigns(): Promise<MarketingCampaign[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    starts_at: typeof row.starts_at === "string" ? row.starts_at : null,
    ends_at: typeof row.ends_at === "string" ? row.ends_at : null,
    channel_notes: typeof row.channel_notes === "string" ? row.channel_notes : null,
    checklist: parseChecklist(row.checklist),
    utm_source: typeof row.utm_source === "string" ? row.utm_source : null,
    utm_medium: typeof row.utm_medium === "string" ? row.utm_medium : null,
    utm_campaign: typeof row.utm_campaign === "string" ? row.utm_campaign : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }));
}
