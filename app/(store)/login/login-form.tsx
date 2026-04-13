"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "@/components/store/container";
import { Heading } from "@/components/store/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Props = {
  nextHref: string;
  notice?: string;
};

export function LoginForm({ nextHref, notice }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessDeniedSession, setAccessDeniedSession] = useState(false);

  useEffect(() => {
    if (notice !== "no_access") return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled && user) setAccessDeniedSession(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [notice]);

  const accessHelp = nextHref.startsWith("/superadmin")
    ? "You are signed in, but this account is not a platform superadmin. In Supabase, add your user id to public.superadmins (SQL or Table Editor), then try again."
    : "You are signed in, but this account is not in the store admin list. In Supabase, add a row to public.admins with your auth user id and role admin or staff (or add yourself to public.superadmins), then try again.";

  async function signOutAndRetry() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setAccessDeniedSession(false);
      router.replace(`/login?next=${encodeURIComponent(nextHref)}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        setError(signError.message);
        return;
      }
      router.push(nextHref);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const isCustomerReturn = nextHref === "/account";

  return (
    <Container className="max-w-md py-16 md:py-24">
      <Heading as="h1" eyebrow={isCustomerReturn ? "Account" : "Store admin"}>
        {isCustomerReturn ? "Sign in" : "Admin sign in"}
      </Heading>
      <p className="mt-2 text-sm text-muted-foreground">
        {isCustomerReturn
          ? "Use your email and password for your customer account."
          : "After signing in, you will go to the admin dashboard if your user is listed in Supabase public.admins or public.superadmins."}
      </p>
      {!isCustomerReturn ? (
        <p className="mt-2 text-sm">
          <Link href="/login?next=/account" className="text-navy underline">
            Customer sign in
          </Link>{" "}
          <span className="text-muted-foreground">(account area)</span>
        </p>
      ) : null}
      {accessDeniedSession ? (
        <div
          className="mt-6 rounded-[var(--radius-md)] border border-border bg-muted/50 p-4 text-sm"
          role="alert"
        >
          <p className="font-medium text-foreground">Access not granted</p>
          <p className="mt-2 text-muted-foreground">{accessHelp}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void signOutAndRetry()} disabled={loading}>
            Sign out and use a different account
          </Button>
        </div>
      ) : null}
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Continue"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/" className="text-navy underline">
          Back to storefront
        </Link>
        {" · "}
        <Link href="/account" className="text-navy underline">
          Account
        </Link>
      </p>
    </Container>
  );
}
