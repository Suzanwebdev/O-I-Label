import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminFeatureFlagsPage() {
  return (
    <AdminModulePage
      title="Feature Flags"
      description="Safely roll out high-impact changes behind toggles before full release."
      bullets={[
        "Enable or disable experiments by environment.",
        "Document owner and rollback plan per flag.",
        "Use gradual rollout for risk reduction.",
      ]}
      ctaHref="/superadmin"
      ctaLabel="View global controls"
    />
  );
}
