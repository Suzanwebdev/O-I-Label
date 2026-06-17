"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/store/container";

export default function ForgotPasswordClient() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-14">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-[var(--radius-lg)] border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a link to choose a new password.
          </p>
        </div>

        {sent ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            If an account exists for that email, you&apos;ll receive a reset link shortly.
          </p>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy || !email} className="w-full">
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

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
