import Link from "next/link";
import { SuperadminWebsiteHealthPanel } from "@/components/superadmin/website-health-panel";
import { getSuperadminSystemSnapshot } from "@/lib/data/superadmin";
import { buildWebsiteHealthSummary } from "@/lib/website-health/present";
import { getWebsiteHealthSnapshot } from "@/lib/website-health/store";

export const dynamic = "force-dynamic";

export default async function SuperadminWebsiteHealthPage() {
  const [snapshot, platform] = await Promise.all([
    getWebsiteHealthSnapshot(),
    getSuperadminSystemSnapshot(),
  ]);
  const events = snapshot.ok ? snapshot.events : [];
  const summary = snapshot.ok ? snapshot.summary : buildWebsiteHealthSummary([]);
  const loadError = snapshot.ok ? null : snapshot.error;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl text-white md:text-3xl">Website Health</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Platform-level view of operational failures captured from checkout, payments, webhooks,
          inventory, email, restock, and auth. Match customer incident references here. This view is
          read-only.
        </p>
        <p className="mt-2 text-xs text-white/45">
          Related:{" "}
          <Link href="/superadmin/system" className="underline underline-offset-4 hover:text-white">
            System snapshot
          </Link>
          {" · "}
          <Link href="/admin/website-health" className="underline underline-offset-4 hover:text-white">
            Admin Website Health
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Operational events</h2>
        <p className="mt-1 text-sm text-white/60">
          Aggregated by fingerprint. Repeated failures increase occurrence count instead of creating
          duplicate rows.
        </p>
        <div className="mt-6">
          {loadError ? (
            <p className="text-sm text-red-300">Could not load website health. Try again shortly.</p>
          ) : (
            <SuperadminWebsiteHealthPanel events={events} summary={summary} platform={platform} />
          )}
        </div>
      </section>
    </div>
  );
}
