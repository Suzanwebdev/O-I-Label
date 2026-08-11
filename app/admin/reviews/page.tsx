import { AdminReviewsPanel } from "@/components/admin/admin-reviews-panel";
import { ReviewsVisibilityToggle } from "@/components/admin/reviews-visibility-toggle";
import { isReviewsFeatureEnabled } from "@/lib/reviews/feature";

export default async function AdminReviewsPage() {
  const enabled = await isReviewsFeatureEnabled();

  return (
    <div className="space-y-6">
      <ReviewsVisibilityToggle initialEnabled={enabled} />
      <AdminReviewsPanel />
    </div>
  );
}
