import { getSuperadminUsersSnapshot } from "@/lib/data/superadmin";
import { RoleAssignmentForm } from "@/components/superadmin/role-assignment-form";
import { TeamMembersTable } from "@/components/superadmin/team-members-table";

export default async function SuperadminUsersPage() {
  const snapshot = await getSuperadminUsersSnapshot();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl text-white md:text-3xl">Users & RBAC</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Manage internal roles and access boundaries for operations, finance, and security workflows.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Assign role</h2>
        <p className="mt-1 text-sm text-white/60">
          Assign or update access for an existing authenticated user by email.
        </p>
        <div className="mt-4">
          <RoleAssignmentForm />
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Role matrix</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm text-white/80">
            <thead className="text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Assigned users</th>
                <th className="px-3 py-2">Scope</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.roleCounts.map((row) => (
                <tr key={row.role} className="border-t border-white/10">
                  <td className="px-3 py-3 font-medium text-white">{row.role}</td>
                  <td className="px-3 py-3">{row.users}</td>
                  <td className="px-3 py-3">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Team members</h2>
        <p className="mt-1 text-sm text-white/60">Update role permissions in-place or remove admin access.</p>
        <div className="mt-4">
          <TeamMembersTable members={snapshot.teamMembers} />
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Recent team changes</h2>
        <ul className="mt-4 space-y-3">
          {snapshot.recentMembers.map((member) => (
            <li
              key={`${member.email}-${member.created_at}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-white">{member.email}</p>
                <p className="text-white/55">{member.role}</p>
              </div>
              <span className="rounded-full border border-white/20 px-2.5 py-1 text-xs text-white/70">
                {new Date(member.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
          {snapshot.recentMembers.length === 0 ? (
            <li className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60">
              No team members found yet.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
