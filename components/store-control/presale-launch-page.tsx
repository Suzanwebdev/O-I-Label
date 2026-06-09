"use client";

import Image from "next/image";
import Link from "next/link";
import { CountdownDisplay } from "@/components/store-control/countdown-display";
import { VipWaitlistForm } from "@/components/store-control/vip-waitlist-form";

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
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#faf8f5]">
      <header className="flex justify-center px-6 pt-10 pb-4 sm:pt-14">
        <Link
          href="/"
          className="font-serif-display text-2xl tracking-tight text-foreground sm:text-3xl"
          aria-label="O & I Label home"
        >
          O & I Label
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 pb-16 pt-2">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Presale preview</p>
          <h1 className="mx-auto mt-5 max-w-2xl font-serif-display text-[clamp(2rem,7vw,3.25rem)] leading-[1.06] tracking-[-0.02em] text-foreground">
            {model.headline}
          </h1>
          {model.supportingText ? (
            <p className="mx-auto mt-5 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              {model.supportingText}
            </p>
          ) : null}
          {model.showWaitlistCount && model.waitlistCount > 0 ? (
            <p className="mt-6 text-xs uppercase tracking-[0.16em] text-foreground/75">
              Join {model.waitlistCount.toLocaleString()} subscribers waiting for launch
            </p>
          ) : null}
        </div>

        {model.countdownTarget ? (
          <CountdownDisplay
            targetIso={model.countdownTarget}
            className="mx-auto mt-10 w-full max-w-lg"
            label={model.countdownLabel ?? "Opens in"}
          />
        ) : null}

        {model.heroImageUrl ? (
          <div className="relative mx-auto mt-10 aspect-[4/5] w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted shadow-[var(--shadow-soft)] sm:aspect-[3/4]">
            <Image
              src={model.heroImageUrl}
              alt="Campaign preview"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 448px"
              priority
            />
          </div>
        ) : null}

        <div className="mx-auto mt-10 w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-white/80 p-6 shadow-[var(--shadow-soft)] backdrop-blur-sm sm:p-8">
          <p className="text-center font-serif-display text-xl text-foreground">VIP waitlist</p>
          <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
            Be first to shop when the edit goes live.
          </p>
          <div className="mt-6">
            <VipWaitlistForm source="presale" ctaLabel={model.presaleCtaLabel} />
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-center gap-5 pt-12 text-xs">
          {model.instagramUrl ? (
            <Link
              href={model.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy underline-offset-4 hover:underline"
            >
              Instagram
            </Link>
          ) : null}
          {model.whatsappUrl ? (
            <Link href={model.whatsappUrl} className="text-navy underline-offset-4 hover:underline">
              WhatsApp
            </Link>
          ) : null}
          <Link href="/" className="text-muted-foreground underline-offset-4 hover:underline">
            Browse the boutique
          </Link>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        &copy; {new Date().getFullYear()} O &amp; I Label
      </footer>
    </div>
  );
}
