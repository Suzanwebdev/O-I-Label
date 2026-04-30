"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/store/container";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const next = searchParams.get("next") || "/";
  const notice = searchParams.get("notice");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-14">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-[var(--radius-lg)] border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your email and password to access your account and admin areas.
          </p>
        </div>

        {notice === "no_access" ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You do not have permission to access that page.
          </p>
        ) : null}
        {notice === "auth_failed" ? (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            Sign-in could not be completed. Please try again.
          </p>
        ) : null}

        <form className="space-y-3" onSubmit={onSubmit}>
          <Input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={busy || !email} className="w-full">
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Container>
  );
}
