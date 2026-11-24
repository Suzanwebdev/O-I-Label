"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

export type PresaleLaunchPageModel = {
  headline: string;
  supportingText: string | null;
  countdownTarget: string | null;
  countdownLabel?: string;
  heroImageUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  presaleCtaLabel: string;
  waitlistCount: number;
  showWaitlistCount: boolean;
};

export function PresaleLaunchPage({ model }: { model: PresaleLaunchPageModel }) {
  const [waitlistOpen, setWaitlistOpen] = React.useState(false);
  const waitlistTriggerRef = React.useRef<HTMLButtonElement>(null);
  const hasHero = Boolean(model.heroImageUrl?.trim());
  const onMedia = hasHero;
  const supporting =
    model.supportingText?.trim() &&
    model.supportingText.trim() !== model.headline.trim()
      ? model.supportingText.trim()
      : null;

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
          Presale preview
        </p>

        <h1
          className={cn(
            "mt-4 max-w-[22rem] font-serif-display leading-[1.12] tracking-[-0.02em] text-balance sm:mt-5 sm:max-w-lg lg:max-w-xl",
            "text-[clamp(1.85rem,6.5vw,2.35rem)] lg:text-[clamp(2rem,2.8vw,2.65rem)]",
            onMedia ? "text-white" : "text-foreground"
          )}
        >
          {model.headline}
        </h1>

        {supporting ? (
          <p
            className={cn(
              "mx-auto mt-4 max-w-sm text-pretty text-sm leading-relaxed sm:mt-5 sm:max-w-md sm:text-[15px]",
              onMedia ? "text-white/78" : "text-muted-foreground"
            )}
          >
            {supporting}
          </p>
        ) : null}

        {model.showWaitlistCount && model.waitlistCount > 0 ? (
          <p
            className={cn(
              "mt-5 text-xs uppercase tracking-[0.16em]",
              onMedia ? "text-white/75" : "text-foreground/75"
            )}
          >
            Join {model.waitlistCount.toLocaleString()} subscribers waiting for launch
          </p>
        ) : null}

        {model.countdownTarget ? (
          <CountdownDisplay
            targetIso={model.countdownTarget}
            className="mx-auto mt-8 w-full max-w-lg lg:mt-10"
            label={model.countdownLabel ?? "Opens in"}
            tone={onMedia ? "onMedia" : "default"}
          />
        ) : null}

        <>
          <Button
            ref={waitlistTriggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={waitlistOpen}
            onClick={() => setWaitlistOpen(true)}
            className={cn(
              "mt-8 h-11 rounded-full px-8 text-[11px] font-semibold uppercase tracking-[0.18em] lg:mt-10",
              onMedia
                ? "bg-white text-black hover:bg-white/90"
                : "bg-black text-white hover:bg-black/90"
            )}
          >
            {model.presaleCtaLabel || "Join waitlist"}
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
                  Be first to shop when the edit goes live.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <VipWaitlistForm
                  source="presale"
                  ctaLabel={model.presaleCtaLabel}
                  onSuccess={() => {
                    window.setTimeout(() => setWaitlistOpen(false), 1600);
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </>

        <div
          className={cn(
            "mt-auto flex flex-wrap items-center justify-center gap-5 pt-10 text-xs lg:pt-12",
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
          <Link
            href="/"
            className={cn(
              "underline-offset-4 hover:underline",
              onMedia ? "text-white/65" : "text-muted-foreground"
            )}
          >
            Browse the boutique
          </Link>
        </div>
      </main>

      <footer
        className={cn(
          "relative z-10 px-6 py-5 text-center text-[10px] uppercase tracking-[0.18em] sm:py-6",
          onMedia ? "border-t border-white/15 text-white/55" : "border-t border-border text-muted-foreground"
        )}
      >
        &copy; {new Date().getFullYear()} O &amp; I Label
      </footer>
    </div>
  );
}
