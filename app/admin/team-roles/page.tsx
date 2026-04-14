import { AdminModulePage } from "@/components/admin/admin-module-page";

export default function AdminTeamRolesPage() {
  return (
    <AdminModulePage
      title="Team & Roles"
      description="Grant access by responsibility while keeping critical permissions restricted."
      bullets={[
        "Map staff to role levels.",
        "Review access before major campaigns.",
        "Coordinate with superadmin access policy.",
      ]}
      ctaHref="/superadmin/users"
      ctaLabel="Open platform user controls"
    />
  );
}
