import { unstable_cache } from "next/cache";
import {
  PUBLIC_CACHE_TAGS,
  PUBLIC_CATALOGUE_REVALIDATE_SECONDS,
  publicCacheKeyParts,
} from "@/lib/cache/public-catalogue";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export type HomeContentRow = {
  sections: Record<string, unknown>;
  updatedAt: string | null;
};

const getCachedHomeContentRow = unstable_cache(
  async (): Promise<HomeContentRow> => {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("home_content")
      .select("sections, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(`[home-content] query failed: ${error.message}`);
    const s = data?.sections;
    const sections =
      s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
    const updatedAt = typeof data?.updated_at === "string" ? data.updated_at : null;
    return { sections, updatedAt };
  },
  publicCacheKeyParts("home-content"),
  { revalidate: PUBLIC_CATALOGUE_REVALIDATE_SECONDS, tags: [PUBLIC_CACHE_TAGS.homeContent] }
);

export async function getHomeContentRow(): Promise<HomeContentRow> {
  try {
    return await getCachedHomeContentRow();
  } catch {
    return { sections: {}, updatedAt: null };
  }
}

export async function getHomeContentSections(): Promise<Record<string, unknown>> {
  const { sections } = await getHomeContentRow();
  return sections;
}
