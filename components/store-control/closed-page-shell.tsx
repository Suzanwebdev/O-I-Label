"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CountdownDisplay } from "@/components/store-control/countdown-display";
import { VipWaitlistForm } from "@/components/store-control/vip-waitlist-form";
import { cn } from "@/lib/utils";

export type ClosedPageViewModel = {
  eyebrow: string;
  headline: string;
  body: string;
  heroImageUrl?: string | null;
  countdownTarget: string | null;
  countdownLabel?: string;
  reopeningDate: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  showNewsletter?: boolean;
  showPrivateForm?: boolean;
  presaleMode?: boolean;
  waitlistCount?: number;
  showWaitlistCount?: boolean;
  presaleCtaLabel?: string;
  /** Analytics source for waitlist rows; defaults to pre-launch. */
  waitlistSource?: string;
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
  const [waitlistOpen, setWaitlistOpen] = React.useState(false);
  const waitlistTriggerRef = React.useRef<HTMLButtonElement>(null);

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

  const hasHero = Boolean(model.heroImageUrl?.trim());
  const onMedia = hasHero;
  const bodyText =
    model.body.trim() && model.body.trim() !== model.headline.trim() ? model.body.trim() : null;

  const reopeningLabel = model.reopeningDate
    ? new Date(model.reopeningDate).toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

  const showWaitlist = model.showNewsletter !== false && !model.showPrivateForm;

  return (
    <div
      className={cn(
        "relative flex min-h-[100dvh] flex-col overflow-x-hidden",
        onMedia ? "bg-black text-white" : "bg-[#faf8f5] text-foreground"
      )}
    >
      {hasHero ? (
        <>
          <div className="absolute inset-0" aria-hidden>
            <Image
              src={model.heroImageUrl!}
              alt=""
              fill
              priority
              sizes="100vw"
              /* Portrait collage: bias upper subjects; landscape viewports still crop — asset limit. */
              className="object-cover object-[center_20%] md:object-[center_18%] lg:object-[center_14%]"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-black/35" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/45"
            aria-hidden
          />
        </>
      ) : null}

      <header className="relative z-10 flex justify-center px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-3 sm:pt-10 sm:pb-4">
        <Link
          href="/"
          className={cn(
            "font-serif-display text-2xl tracking-tight sm:text-[1.75rem]",
            onMedia ? "text-white" : "text-foreground"
          )}
          aria-label="O & I Label home"
        >
          O & I Label
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 text-center sm:max-w-2xl sm:pt-6 lg:max-w-3xl">
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.28em]",
            onMedia ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {model.eyebrow}
        </p>

        <h1
          className={cn(
            "mt-4 max-w-[22rem] font-serif-display leading-[1.12] tracking-[-0.02em] text-balance sm:mt-5 sm:max-w-lg lg:max-w-xl",
            /* Mobile keeps presence; desktop is tighter so copy doesn't dominate the campaign. */
            "text-[clamp(1.7rem,6.2vw,2.15rem)] lg:text-[clamp(1.85rem,2.6vw,2.35rem)]",
            onMedia ? "text-white" : "text-foreground"
          )}
        >
          {model.headline}
        </h1>

        {bodyText ? (
          <p
            className={cn(
              "mx-auto mt-4 max-w-sm text-pretty text-sm leading-relaxed sm:mt-5 sm:max-w-md sm:text-[15px]",
              onMedia ? "text-white/78" : "text-muted-foreground"
            )}
          >
            {bodyText}
          </p>
        ) : null}

        {model.showWaitlistCount && (model.waitlistCount ?? 0) > 0 ? (
          <p
            className={cn(
              "mt-4 text-xs uppercase tracking-[0.16em]",
              onMedia ? "text-white/75" : "text-foreground/80"
            )}
          >
            Join {(model.waitlistCount ?? 0).toLocaleString()} subscribers waiting for launch
          </p>
        ) : null}

        {reopeningLabel ? (
          <p
            className={cn(
              "mt-4 text-xs uppercase tracking-[0.16em]",
              onMedia ? "text-white/75" : "text-foreground/80"
            )}
          >
            Returning {reopeningLabel}
          </p>
        ) : null}

        {model.countdownTarget ? (
          <CountdownDisplay
            targetIso={model.countdownTarget}
            className="mx-auto mt-8 w-full max-w-md lg:mt-10"
            label={model.countdownLabel ?? "Launching in"}
            tone={onMedia ? "onMedia" : "default"}
          />
        ) : null}

        {model.showPrivateForm ? (
          <form
            onSubmit={submitAccess}
            className="mx-auto mt-8 w-full max-w-sm space-y-3 text-left lg:mt-10"
          >
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "h-11 rounded-full border-border px-4",
                onMedia ? "border-white/30 bg-white/95 text-foreground" : "bg-white"
              )}
            />
            <Input
              type="password"
              placeholder="Access password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                "h-11 rounded-full border-border px-4",
                onMedia ? "border-white/30 bg-white/95 text-foreground" : "bg-white"
              )}
            />
            {error ? <p className="text-center text-xs text-red-200">{error}</p> : null}
            <Button
              type="submit"
              disabled={busy || granted}
              className="h-11 w-full rounded-full bg-white text-[13px] font-semibold text-black hover:bg-white/90"
            >
              {busy ? "Checking…" : "Enter preview"}
            </Button>
          </form>
        ) : null}

        {showWaitlist ? (
          <>
            {/*
              Controlled Dialog + plain Button (no Radix trigger wrapper).
              Avoids SSR/client aria-id mismatches that caused hydration warnings.
            */}
            <Button
              ref={waitlistTriggerRef}
              type="button"
              variant="outline"
              aria-haspopup="dialog"
              aria-expanded={waitlistOpen}
              onClick={() => setWaitlistOpen(true)}
              className={cn(
                "mt-8 h-11 rounded-full px-8 text-[11px] font-semibold uppercase tracking-[0.18em] lg:mt-10",
                onMedia
                  ? "border-white/55 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  : "border-border bg-white/80 text-foreground hover:bg-white"
              )}
            >
              VIP waitlist
            </Button>
            <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
              <DialogContent
                className="max-h-[min(90dvh,640px)] w-[calc(100%-1.5rem)] overflow-y-auto border-border bg-[#faf8f5] p-6 sm:max-w-md sm:p-8"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  waitlistTriggerRef.current?.focus();
                }}
              >
                <DialogHeader className="text-center sm:text-center">
                  <DialogTitle className="font-serif-display text-2xl tracking-tight text-foreground">
                    VIP waitlist
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Be first to experience the next chapter of O &amp; I Label.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  <VipWaitlistForm
                    source={model.waitlistSource ?? "pre-launch"}
                    ctaLabel={model.presaleCtaLabel ?? "Join the private list"}
                    compact
                    onSuccess={() => {
                      window.setTimeout(() => setWaitlistOpen(false), 1600);
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : null}

        <div
          className={cn(
            "mt-auto flex flex-wrap items-center justify-center gap-4 pt-10 text-xs lg:pt-12",
            onMedia ? "text-white/80" : "text-navy"
          )}
        >
          {model.instagramUrl ? (
            <Link
              href={model.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Instagram
            </Link>
          ) : null}
          {model.whatsappUrl ? (
            <Link
              href={model.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              WhatsApp
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
