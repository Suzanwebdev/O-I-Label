import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminAnalyticsPage() {
  return (
    <AdminModulePage
      title="Analytics"
      description="Track performance across traffic, conversion, and sales by channel."
      bullets={[
        "Revenue trend and order velocity by day/week/month.",
        "Top products and category contribution.",
        "Conversion and abandonment checkpoints.",
      ]}
    />
  );
}
