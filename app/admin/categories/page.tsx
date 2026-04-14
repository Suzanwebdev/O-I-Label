import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminCategoriesPage() {
  return (
    <AdminModulePage
      title="Categories"
      description="Manage storefront taxonomy used by filters, navigation, and merchandising."
      bullets={[
        "Create, reorder, and retire category groups.",
        "Control slugs and category descriptions.",
        "Pin featured categories to homepage sections.",
      ]}
    />
  );
}
