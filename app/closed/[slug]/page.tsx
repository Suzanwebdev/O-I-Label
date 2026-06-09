import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClosedPageShell } from "@/components/store-control/closed-page-shell";
import { PresaleLaunchPage } from "@/components/store-control/presale-launch-page";
import { defaultSupportingMessage } from "@/lib/store-control/constants";
import { getEffectiveStoreControl } from "@/lib/store-control/server";
import { getHomepageCms } from "@/lib/data/homepage-cms";

const SLUGS = new Set([
  "maintenance",
  "pre-launch",
  "holiday",
  "inventory",
  "private-access",
  "presale",
]);

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUGS.has(slug)) return { robots: { index: false, follow: false } };

  const control = await getEffectiveStoreControl();
  const crawlable =
    slug === "presale" ||
    control.storeStatus === "presale" ||
    control.storeStatus === "soft_close" ||
    control.softCloseMode;

  return {
    title: slug === "presale" ? "Presale Preview — O & I Label" : "O & I Label",
    description: control.maintenanceMessage,
    robots: crawlable ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical: slug === "presale" ? "/closed/presale" : undefined },
  };
}

export default async function ClosedStatusPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUGS.has(slug)) notFound();

  const [control, cms] = await Promise.all([getEffectiveStoreControl(), getHomepageCms()]);

  const instagramFromCms =
    cms.footer.social.find((s) => /instagram/i.test(`${s.label} ${s.href}`))?.href ?? null;
  const instagramUrl = control.instagramUrl ?? instagramFromCms;
  const whatsappUrl = control.whatsappUrl;

  if (slug === "presale") {
    return (
      <PresaleLaunchPage
        model={{
          headline: control.maintenanceMessage || "Preview the collection before launch.",
          supportingText:
            control.supportingMessage ?? defaultSupportingMessage("presale"),
          countdownTarget: control.countdownEnabled ? control.countdownTarget : null,
          countdownLabel: "Opens in",
          heroImageUrl: control.presaleHeroImageUrl,
          instagramUrl,
          whatsappUrl,
          presaleCtaLabel: control.presaleCtaLabel,
          waitlistCount: control.waitlistCount,
          showWaitlistCount: control.showWaitlistCount,
        }}
      />
    );
  }

  const heroBySlug: Record<string, string | null> = {
    maintenance: control.maintenanceHeroImageUrl,
    "pre-launch": control.launchHeroImageUrl,
    holiday: control.maintenanceHeroImageUrl,
    inventory: control.maintenanceHeroImageUrl,
  };

  const headline = control.maintenanceMessage;
  const body =
    slug === "pre-launch"
      ? control.supportingMessage ?? "A new chapter of O & I Label is almost here."
      : slug === "private-access"
        ? "This preview is reserved for invited guests."
        : control.supportingMessage ?? control.maintenanceMessage;

  const eyebrowMap: Record<string, string> = {
    maintenance: "Atelier pause",
    "pre-launch": "Coming soon",
    holiday: "Holiday pause",
    inventory: "Collection update",
    "private-access": "Private preview",
    presale: "Presale preview",
  };

  return (
    <ClosedPageShell
      model={{
        eyebrow: eyebrowMap[slug] ?? "O & I Label",
        headline,
        body,
        heroImageUrl: heroBySlug[slug] ?? null,
        countdownTarget: control.countdownEnabled ? control.countdownTarget : null,
        countdownLabel:
          slug === "pre-launch" ? "Launching in" : "Returning in",
        reopeningDate: control.reopeningDate,
        instagramUrl,
        whatsappUrl,
        showNewsletter: slug !== "private-access",
        showPrivateForm: slug === "private-access",
        presaleMode: false,
        waitlistCount: control.waitlistCount,
        showWaitlistCount: control.showWaitlistCount && slug === "pre-launch",
        presaleCtaLabel: control.presaleCtaLabel,
      }}
    />
  );
}
