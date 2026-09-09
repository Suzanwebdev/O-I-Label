"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConsent } from "@/components/consent/consent-provider";

export function CookieConsentUi() {
  const {
    ready,
    decided,
    state,
    preferencesOpen,
    acceptAll,
    rejectAll,
    savePreferences,
    openPreferences,
    closePreferences,
  } = useConsent();

  const [draftAnalytics, setDraftAnalytics] = React.useState(false);
  const [draftMarketing, setDraftMarketing] = React.useState(false);

  React.useEffect(() => {
    if (!preferencesOpen) return;
    setDraftAnalytics(state.analytics);
    setDraftMarketing(state.marketing);
  }, [preferencesOpen, state.analytics, state.marketing]);

  const showBanner = ready && !decided && !preferencesOpen;

  return (
    <>
      {showBanner ? (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
        >
          <div className="mx-auto max-w-3xl border border-border/80 bg-background/95 p-4 shadow-[var(--shadow-soft)] backdrop-blur-md supports-[backdrop-filter]:bg-background/90 sm:p-5">
            <p className="text-sm leading-relaxed text-foreground md:text-[15px]">
              We use cookies to make your shopping experience smoother, remember your
              preferences, and help you discover a better O & I Label experience.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button type="button" size="sm" className="w-full sm:w-auto" onClick={acceptAll}>
                Accept All
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={rejectAll}
              >
                Reject All
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={openPreferences}
              >
                Preferences
              </Button>
              <Link
                href="/policies/cookies"
                className="inline-flex h-9 items-center justify-center px-1 text-sm font-medium text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 sm:ml-1"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <Sheet open={preferencesOpen} onOpenChange={(open) => (open ? openPreferences() : closePreferences())}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:mx-auto sm:max-w-lg sm:rounded-t-[var(--radius-lg)]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif-display text-2xl tracking-tight">
              Cookie preferences
            </SheetTitle>
            <SheetDescription className="text-sm leading-relaxed">
              Choose which optional cookies we may use. Essential cookies stay on so shopping,
              checkout, and security keep working.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="rounded-[var(--radius-md)] border border-border/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Essential</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Required for core website functionality such as shopping, cart, checkout, and
                    security.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Always on
                </span>
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] border border-border/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 pr-2">
                  <Label htmlFor="consent-analytics" className="text-sm font-semibold text-foreground">
                    Analytics
                  </Label>
                  <p id="consent-analytics-desc" className="text-sm leading-relaxed text-muted-foreground">
                    Helps us understand how visitors use O & I Label so we can improve your
                    experience.
                  </p>
                </div>
                <Switch
                  id="consent-analytics"
                  checked={draftAnalytics}
                  onCheckedChange={setDraftAnalytics}
                  aria-describedby="consent-analytics-desc"
                />
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] border border-border/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 pr-2">
                  <Label htmlFor="consent-marketing" className="text-sm font-semibold text-foreground">
                    Marketing
                  </Label>
                  <p id="consent-marketing-desc" className="text-sm leading-relaxed text-muted-foreground">
                    Helps us measure and improve the relevance and performance of our advertising.
                  </p>
                </div>
                <Switch
                  id="consent-marketing"
                  checked={draftMarketing}
                  onCheckedChange={setDraftMarketing}
                  aria-describedby="consent-marketing-desc"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={closePreferences}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() =>
                savePreferences({
                  analytics: draftAnalytics,
                  marketing: draftMarketing,
                })
              }
            >
              Save Preferences
            </Button>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Read more in our{" "}
            <Link href="/policies/cookies" className="text-navy underline-offset-4 hover:underline">
              Cookie Policy
            </Link>
            .
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
