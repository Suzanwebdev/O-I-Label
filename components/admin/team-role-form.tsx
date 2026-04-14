"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TeamRoleForm() {
  const router = useRouter();
  const [userId, setUserId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"superadmin" | "admin" | "staff">("staff");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/team-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email, role }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not assign role");
        return;
      }
      setUserId("");
      setEmail("");
      setRole("staff");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <Input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Auth user id"
          required
          disabled={busy}
        />
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          required
          disabled={busy}
        />
        <Select value={role} onValueChange={(v) => setRole(v as typeof role)} disabled={busy}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="staff">staff</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="superadmin">superadmin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Assigning..." : "Assign role"}
        </Button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </form>
  );
}

