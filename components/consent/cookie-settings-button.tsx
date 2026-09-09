"use client";

import { useConsentOptional } from "@/components/consent/consent-provider";

export function CookieSettingsButton({
  className,
}: {
  className?: string;
}) {
  const consent = useConsentOptional();

  return (
    <button
      type="button"
      onClick={() => consent?.openPreferences()}
      disabled={!consent?.ready}
      className={
        className ??
        "text-[11px] tracking-[0.06em] text-white/50 transition-colors hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50"
      }
    >
      Cookie Settings
    </button>
  );
}
