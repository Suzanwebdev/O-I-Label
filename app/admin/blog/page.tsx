import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminBlogPage() {
  return (
    <AdminModulePage
      title="Blog"
      description="Draft, publish, and optimize journal posts for editorial and SEO growth."
      bullets={[
        "Create post drafts with cover media.",
        "Schedule and publish style stories.",
        "Manage excerpts and article metadata.",
      ]}
      ctaHref="/admin/content"
      ctaLabel="Open content center"
    />
  );
}
