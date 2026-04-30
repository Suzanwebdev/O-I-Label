import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { createServiceRoleClient } from "@/lib/supabase/server";

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

  const sections = (body as { sections?: unknown })?.sections;
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) {
    return NextResponse.json({ error: "sections must be a JSON object" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("home_content")
    .update({ sections, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("sections")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sections: data.sections });
}
