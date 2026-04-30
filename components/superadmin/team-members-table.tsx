"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Role = "superadmin" | "admin" | "staff";

type TeamMember = {
  user_id: string;
  email: string;
  role: Role;
  created_at: string;
};

export function TeamMembersTable({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const [roles, setRoles] = React.useState<Record<string, Role>>(
    Object.fromEntries(members.map((m) => [m.user_id, m.role])) as Record<string, Role>
  );
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function saveRole(member: TeamMember) {
    const nextRole = roles[member.user_id] ?? member.role;
    setBusyUserId(member.user_id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/superadmin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email, role: nextRole }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not update role");
        return;
      }
      setSuccess(`Updated ${member.email} to ${nextRole}.`);
      router.refresh();
    } catch {
      setError("Network error while updating role");
    } finally {
      setBusyUserId(null);
    }
  }

  async function removeAccess(member: TeamMember) {
    if (!window.confirm(`Remove admin access for ${member.email}?`)) return;

    setBusyUserId(member.user_id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/superadmin/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not remove access");
        return;
      }
      setSuccess(`Removed admin access for ${member.email}.`);
      router.refresh();
    } catch {
      setError("Network error while removing access");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm text-white/80">
          <thead className="text-xs uppercase tracking-wider text-white/50">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Current role</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr className="border-t border-white/10">
                <td colSpan={4} className="px-3 py-6 text-center text-white/60">
                  No team members found.
                </td>
              </tr>
            ) : null}
            {members.map((member) => {
              const rowBusy = busyUserId === member.user_id;
              const selectedRole = roles[member.user_id] ?? member.role;
              const dirty = selectedRole !== member.role;
              return (
                <tr key={member.user_id} className="border-t border-white/10">
                  <td className="px-3 py-3">
                    <p className="font-medium text-white">{member.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      value={selectedRole}
                      onValueChange={(v) =>
                        setRoles((prev) => ({ ...prev, [member.user_id]: v as Role }))
                      }
                      disabled={rowBusy}
                    >
                      <SelectTrigger className="h-9 w-[180px] border-white/20 bg-black/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">staff</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="superadmin">superadmin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-3">{new Date(member.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={rowBusy || !dirty}
                        className="h-8 bg-white text-black hover:bg-neutral-200"
                        onClick={() => void saveRole(member)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rowBusy}
                        className="h-8 border-white/20 bg-transparent text-white hover:bg-white/10"
                        onClick={() => void removeAccess(member)}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
