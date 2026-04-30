"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RoleAssignmentForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"superadmin" | "admin" | "staff">("staff");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/superadmin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(json.error ?? "Could not assign role");
        return;
      }

      setSuccess(`Assigned ${role} to ${email}.`);
      setEmail("");
      setRole("staff");
      router.refresh();
    } catch {
      setError("Network error while assigning role");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@domain.com"
          type="email"
          required
          disabled={busy}
          className="border-white/20 bg-black/20 text-white placeholder:text-white/40"
        />
        <Select value={role} onValueChange={(v) => setRole(v as typeof role)} disabled={busy}>
          <SelectTrigger className="border-white/20 bg-black/20 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="staff">staff</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="superadmin">superadmin</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={busy || !email} className="bg-white text-black hover:bg-neutral-200">
          {busy ? "Assigning..." : "Assign role"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
    </form>
  );
}
