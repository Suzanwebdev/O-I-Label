import Link from "next/link";
import type { Metadata } from "next";
import { resolveStorefrontClosedDisplay } from "@/lib/storefront-closed";
import { getStorefrontClosedSettings } from "@/lib/storefront-closed-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store unavailable",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const settings = await getStorefrontClosedSettings();
  const display = settings
    ? resolveStorefrontClosedDisplay(settings)
    : resolveStorefrontClosedDisplay({
        storefront_closed_preset: "maintenance",
        storefront_closed_copy: {},
      });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        O &amp; I Label
      </p>
      <h1 className="mt-3 font-serif-display text-3xl text-foreground md:text-4xl">
        {display.title}
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        {display.message}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
        <Link href="/track-order" className="text-navy underline-offset-2 hover:underline">
          Track an existing order
        </Link>
        <Link href="/login" className="text-muted-foreground underline-offset-2 hover:underline">
          Staff login
        </Link>
      </div>
    </div>
  );
}
