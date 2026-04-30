import { TeamRoleForm } from "@/components/admin/team-role-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminTeamMembers } from "@/lib/data/admin";

export default async function AdminTeamRolesPage() {
  const members = await listAdminTeamMembers();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Team & Roles</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign role</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamRoleForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length ? (
            members.map((m) => (
              <div key={m.user_id} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{m.email || m.user_id}</p>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{m.role}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.user_id}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No admin users found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
