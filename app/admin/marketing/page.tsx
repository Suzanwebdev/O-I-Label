import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminMarketingPage() {
  return (
    <AdminModulePage
      title="Marketing"
      description="Plan campaigns and coordinate promotional channels from one workspace."
      bullets={[
        "Campaign calendar and channel notes.",
        "Launch checklists for paid/organic drops.",
        "Attribution tags for conversion review.",
      ]}
    />
  );
}
