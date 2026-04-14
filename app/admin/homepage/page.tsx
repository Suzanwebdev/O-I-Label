import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminHomepagePage() {
  return (
    <AdminModulePage
      title="Homepage"
      description="Control homepage modules, hero content, and merchandising blocks."
      bullets={[
        "Hero slides and featured categories.",
        "Occasion cards and best-seller rows.",
        "Section ordering and campaign visibility.",
      ]}
      ctaHref="/admin/content"
      ctaLabel="Edit homepage content"
    />
  );
}
