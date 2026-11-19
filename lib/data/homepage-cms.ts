import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getHomeContentSections } from "@/lib/data/home-content";
import { parseHomepageCms, type HomepageCms } from "@/lib/home/homepage-cms";

/** Request-scoped: the store layout and homepage share one parse per request. */
export const getHomepageCms = cache(async (): Promise<HomepageCms> => {
  const sections = await getHomeContentSections();
  return parseHomepageCms(sections);
});

export async function getHomeContentSectionsAdmin(): Promise<Record<string, unknown>> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("home_content").select("sections").eq("id", 1).maybeSingle();
  const s = data?.sections;
  return s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
}

export async function getHomepageCmsAdmin(): Promise<HomepageCms> {
  return parseHomepageCms(await getHomeContentSectionsAdmin());
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
