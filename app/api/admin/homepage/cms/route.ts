import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import {
  mergeSectionsPatch,
  parseHomepageCms,
  validateHeroForSave,
  type HomeFooterCms,
  type HomeHeroCms,
  type HomePromoBandCms,
  type HomeSectionLabelsCms,
} from "@/lib/home/homepage-cms";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET() {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service.from("home_content").select("sections").eq("id", 1).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sections =
    data?.sections && typeof data.sections === "object" && !Array.isArray(data.sections)
      ? (data.sections as Record<string, unknown>)
      : {};

  return NextResponse.json({ cms: parseHomepageCms(sections) });
}

export async function PATCH(request: Request) {
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
    hero?: HomeHeroCms;
    footer?: HomeFooterCms;
    promo_band?: HomePromoBandCms;
    homepage_sections?: HomeSectionLabelsCms;
  };

  if (b.hero) {
    const err = validateHeroForSave(b.hero);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: row, error: fetchErr } = await service
    .from("home_content")
    .select("sections")
    .eq("id", 1)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const current =
    row?.sections && typeof row.sections === "object" && !Array.isArray(row.sections)
      ? (row.sections as Record<string, unknown>)
      : {};

  const sections = mergeSectionsPatch(current, {
    hero: b.hero,
    footer: b.footer,
    promo_band: b.promo_band,
    homepage_sections: b.homepage_sections,
  });

  const { data, error } = await service
    .from("home_content")
    .update({ sections, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("sections")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const merged =
    data.sections && typeof data.sections === "object" && !Array.isArray(data.sections)
      ? (data.sections as Record<string, unknown>)
      : {};

  return NextResponse.json({ cms: parseHomepageCms(merged) });
}
