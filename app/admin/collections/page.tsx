import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminCollectionsPage() {
  return (
    <AdminModulePage
      title="Collections"
      description="Build manual and smart collections to power campaigns and edits."
      bullets={[
        "Create seasonal and occasion collections.",
        "Add smart rules for automated merchandising.",
        "Schedule collection visibility windows.",
      ]}
    />
  );
}
