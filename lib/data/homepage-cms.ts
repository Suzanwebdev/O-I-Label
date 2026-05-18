import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getHomeContentSections } from "@/lib/data/home-content";
import { parseHomepageCms, type HomepageCms } from "@/lib/home/homepage-cms";

export async function getHomepageCms(): Promise<HomepageCms> {
  const sections = await getHomeContentSections();
  return parseHomepageCms(sections);
}

export async function getHomepageCmsAdmin(): Promise<HomepageCms> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("home_content").select("sections").eq("id", 1).maybeSingle();
  const s = data?.sections;
  const sections =
    s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
  return parseHomepageCms(sections);
}

export async function getHomeContentSectionsRecord(): Promise<Record<string, unknown>> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("home_content").select("sections").eq("id", 1).maybeSingle();
    const s = data?.sections;
    if (s && typeof s === "object" && !Array.isArray(s)) {
      return s as Record<string, unknown>;
    }
  } catch {
    /* use empty */
  }
  return {};
}
