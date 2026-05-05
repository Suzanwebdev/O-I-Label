import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChecklistItem = { id: string; label: string; done: boolean };

function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!label) continue;
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : randomUUID();
    out.push({ id, label: label.slice(0, 500), done: Boolean(r.done) });
    if (out.length >= 40) break;
  }
  return out;
}

function parseOptionalTs(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function trimOrNull(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  return s.slice(0, max);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title =
    typeof (body as { title?: unknown })?.title === "string" ? (body as { title: string }).title.trim() : "";
  if (!title || title.length > 200) {
    return NextResponse.json({ error: "Title is required (max 200 characters)" }, { status: 400 });
  }

  const startsAt = parseOptionalTs((body as { startsAt?: unknown })?.startsAt);
  const endsAt = parseOptionalTs((body as { endsAt?: unknown })?.endsAt);
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: "End must be after start" }, { status: 400 });
  }

  const channel_notes = trimOrNull((body as { channelNotes?: unknown })?.channelNotes, 12000);
  const checklist = parseChecklist((body as { checklist?: unknown })?.checklist);
  const utm_source = trimOrNull((body as { utmSource?: unknown })?.utmSource, 120);
  const utm_medium = trimOrNull((body as { utmMedium?: unknown })?.utmMedium, 120);
  const utm_campaign = trimOrNull((body as { utmCampaign?: unknown })?.utmCampaign, 120);

  const service = createServiceRoleClient();
  const { error } = await service
    .from("marketing_campaigns")
    .update({
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      channel_notes,
      checklist,
      utm_source,
      utm_medium,
      utm_campaign,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { error } = await service.from("marketing_campaigns").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
