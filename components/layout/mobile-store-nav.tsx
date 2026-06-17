"use client";

import * as React from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetClose } from "@/components/ui/sheet";
import { MOBILE_NAV_EDITORIAL_CTA, MOBILE_STORE_NAV } from "@/lib/navigation/mobile-menu";
import { cn } from "@/lib/utils";

const navLinkClass =
  "flex min-h-11 items-center rounded-[var(--radius-md)] px-4 py-2.5 text-[15px] font-medium leading-snug text-foreground transition-colors hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30";

const sectionTriggerClass =
  "mb-3 w-full px-4 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30";

function MobileNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <SheetClose asChild>
      <Link href={href} className={navLinkClass}>
        {children}
      </Link>
    </SheetClose>
  );
}

export function MobileStoreNav() {
  const [openSections, setOpenSections] = React.useState<Set<string>>(() => new Set());

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border/70 px-6 pb-7 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <SheetClose asChild>
          <Link
            href="/"
            className="block font-serif-display text-[1.65rem] leading-none tracking-tight text-foreground"
          >
            O & I Label
          </Link>
        </SheetClose>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Premium Women&apos;s Fashion
        </p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <nav
          className="px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          aria-label="Mobile storefront"
        >
          {MOBILE_STORE_NAV.map((section, index) => {
            const isOpen = openSections.has(section.id);
            const panelId = `mobile-nav-${section.id}`;

            return (
            <div
              key={section.id}
              className={cn(index > 0 && "mt-8 border-t border-border/50 pt-8")}
            >
              <button
                type="button"
                className={sectionTriggerClass}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleSection(section.id)}
              >
                {section.label}
              </button>
              {isOpen ? (
                <ul id={panelId} className="space-y-0.5">
                  {section.links.map((link) => (
                    <li key={`${section.id}-${link.href}`}>
                      <MobileNavLink href={link.href}>{link.label}</MobileNavLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            );
          })}

          {MOBILE_NAV_EDITORIAL_CTA ? (
            <div className="mt-10 border-t border-border/50 pt-8">
              <div className="mx-1 rounded-[var(--radius-lg)] border border-border/60 bg-muted/25 px-5 py-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {MOBILE_NAV_EDITORIAL_CTA.title}
                </p>
                <p className="mt-3 font-serif-display text-lg leading-snug text-foreground">
                  {MOBILE_NAV_EDITORIAL_CTA.body}
                </p>
                <SheetClose asChild>
                  <Link
                    href={MOBILE_NAV_EDITORIAL_CTA.href}
                    className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {MOBILE_NAV_EDITORIAL_CTA.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </SheetClose>
              </div>
            </div>
          ) : null}
        </nav>
      </ScrollArea>
    </div>
  );
}
