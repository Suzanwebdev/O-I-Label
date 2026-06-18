import { createServerSupabaseClient } from "@/lib/supabase/server";

export type HomeContentRow = {
  sections: Record<string, unknown>;
  updatedAt: string | null;
};

export async function getHomeContentRow(): Promise<HomeContentRow> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("home_content")
      .select("sections, updated_at")
      .eq("id", 1)
      .maybeSingle();
    const s = data?.sections;
    const sections =
      s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
    const updatedAt = typeof data?.updated_at === "string" ? data.updated_at : null;
    return { sections, updatedAt };
  } catch {
    return { sections: {}, updatedAt: null };
  }
}

export async function getHomeContentSections(): Promise<Record<string, unknown>> {
  const { sections } = await getHomeContentRow();
  return sections;
}
