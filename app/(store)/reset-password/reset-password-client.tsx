"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/store/container";

export default function ResetPasswordClient() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-14">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-[var(--radius-lg)] border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your new password below.</p>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <Input
            type="password"
            name="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            type="password"
            name="confirm"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-navy underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </Container>
  );
}
