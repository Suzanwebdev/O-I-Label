"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountdownDisplay } from "@/components/store-control/countdown-display";
import { HomeNewsletter } from "@/components/home/newsletter-block";

export type ClosedPageViewModel = {
  eyebrow: string;
  headline: string;
  body: string;
  countdownTarget: string | null;
  countdownLabel?: string;
  reopeningDate: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  showNewsletter?: boolean;
  showPrivateForm?: boolean;
  presaleMode?: boolean;
};

export function ClosedPageShell({
  model,
}: {
  model: ClosedPageViewModel;
}) {
  const [password, setPassword] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [granted, setGranted] = React.useState(false);

  async function submitAccess(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store-control/private-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: password.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Access denied.");
        return;
      }
      setGranted(true);
      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const reopeningLabel = model.reopeningDate
    ? new Date(model.reopeningDate).toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#faf8f5]">
      <header className="flex justify-center px-6 pt-10 pb-6 sm:pt-14">
        <Link
          href="/"
          className="font-serif-display text-2xl tracking-tight text-foreground sm:text-3xl"
          aria-label="O & I Label home"
        >
          O & I Label
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-16 pt-4 text-center sm:max-w-xl">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{model.eyebrow}</p>
        <h1 className="mt-4 font-serif-display text-[clamp(1.75rem,6vw,2.5rem)] leading-[1.08] tracking-[-0.02em] text-foreground">
          {model.headline}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          {model.body}
        </p>

        {reopeningLabel ? (
          <p className="mt-5 text-xs uppercase tracking-[0.16em] text-foreground/80">
            Returning {reopeningLabel}
          </p>
        ) : null}

        {model.countdownTarget ? (
          <CountdownDisplay
            targetIso={model.countdownTarget}
            className="mx-auto mt-10 w-full max-w-md"
            label={model.countdownLabel ?? "Launching in"}
          />
        ) : null}

        {model.showPrivateForm ? (
          <form onSubmit={submitAccess} className="mx-auto mt-10 w-full max-w-sm space-y-3 text-left">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-full border-border bg-white px-4"
            />
            <Input
              type="password"
              placeholder="Access password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-full border-border bg-white px-4"
            />
            {error ? <p className="text-center text-xs text-red-700">{error}</p> : null}
            <Button
              type="submit"
              disabled={busy || granted}
              className="h-11 w-full rounded-full bg-black text-[13px] font-semibold"
            >
              {busy ? "Checking…" : "Enter preview"}
            </Button>
          </form>
        ) : null}

        {model.showNewsletter !== false ? (
          <div className="mx-auto mt-10 w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-white/70 p-5 shadow-[var(--shadow-soft)]">
            <p className="mb-4 font-serif-display text-lg text-foreground">Stay in the know</p>
            <HomeNewsletter compact refined />
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-center gap-4 pt-10 text-xs">
          {model.instagramUrl ? (
            <Link href={model.instagramUrl} className="text-navy underline-offset-4 hover:underline">
              Instagram
            </Link>
          ) : null}
          {model.whatsappUrl ? (
            <Link href={model.whatsappUrl} className="text-navy underline-offset-4 hover:underline">
              WhatsApp
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
