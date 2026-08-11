import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getRequestAuthz } from "@/lib/authz";
import { redirect } from "next/navigation";
import { ReviewsVisibilityToggle } from "@/components/admin/reviews-visibility-toggle";
import { isReviewsFeatureEnabled } from "@/lib/reviews/feature";

export default async function SuperadminReviewsPage() {
  const authz = await getRequestAuthz();
  if (!authz.isSuperadmin) redirect("/admin");

  const service = createServiceRoleClient();
  const enabled = await isReviewsFeatureEnabled();
  const statuses = ["pending", "published", "rejected", "hidden"] as const;
  const counts: Record<string, number> = {};
  for (const status of statuses) {
    const { count } = await service
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    counts[status] = count ?? 0;
  }

  return (
    <div className="space-y-6 text-white">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold">Reviews oversight</h1>
        <p className="mt-1 text-sm text-white/60">
          Control storefront visibility and review volumes. Day-to-day moderation lives in Admin →
          Reviews.
        </p>
      </div>

      <ReviewsVisibilityToggle initialEnabled={enabled} appearance="dark" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statuses.map((status) => (
          <div key={status} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">{status}</p>
            <p className="mt-2 font-serif-display text-3xl">{counts[status]}</p>
          </div>
        ))}
      </div>
      <Link href="/admin/reviews" className="inline-block text-sm text-white underline underline-offset-4">
        Open Admin Reviews →
      </Link>
    </div>
  );
}
