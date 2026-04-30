import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getHomeContentSections(): Promise<Record<string, unknown>> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("home_content").select("sections").eq("id", 1).maybeSingle();
  const s = data?.sections;
  if (s && typeof s === "object" && !Array.isArray(s)) {
    return s as Record<string, unknown>;
  }
  return {};
}
