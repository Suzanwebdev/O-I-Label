"use client";

import { Button } from "@/components/ui/button";
import { useConsentOptional } from "@/components/consent/consent-provider";

/** Opens the existing consent preferences sheet (same system as the banner). */
export function CookieSettingsButton({
  className,
  variant = "default",
  size = "default",
}: {
  className?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "navy";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const consent = useConsentOptional();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => consent?.openPreferences()}
      disabled={!consent?.ready}
    >
      Cookie Settings
    </Button>
  );
}
