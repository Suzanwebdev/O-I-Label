import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClosedPageShell } from "@/components/store-control/closed-page-shell";
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

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string }> };

export default async function ClosedStatusPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUGS.has(slug)) notFound();

  const [control, cms] = await Promise.all([getEffectiveStoreControl(), getHomepageCms()]);

  const instagramFromCms =
    cms.footer.social.find((s) => /instagram/i.test(`${s.label} ${s.href}`))?.href ?? null;
  const instagramUrl = control.instagramUrl ?? instagramFromCms;
  const whatsappUrl = control.whatsappUrl;

  const headline = control.maintenanceMessage;
  const body =
    slug === "presale"
      ? "Explore the edit — purchasing opens at launch."
      : slug === "pre-launch"
        ? "A new chapter of O & I Label is almost here."
        : slug === "private-access"
          ? "This preview is reserved for invited guests."
          : control.maintenanceMessage;

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
        countdownTarget: control.countdownEnabled ? control.countdownTarget : null,
        countdownLabel:
          slug === "presale"
            ? "Opens in"
            : slug === "pre-launch"
              ? "Launching in"
              : "Returning in",
        reopeningDate: control.reopeningDate,
        instagramUrl,
        whatsappUrl,
        showNewsletter: slug !== "private-access",
        showPrivateForm: slug === "private-access",
        presaleMode: slug === "presale",
      }}
    />
  );
}
