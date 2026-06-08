import { StoreControlDashboard } from "@/components/admin/store-control-dashboard";
import { getStoreControlAdminSnapshot } from "@/lib/store-control/server";

export const dynamic = "force-dynamic";

export default async function SuperadminStoreControlPage() {
  const snapshot = await getStoreControlAdminSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl text-white md:text-3xl">Store control</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Full storefront availability console — modes, messaging, scheduling, banners, and private access.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-50 shadow-xl shadow-black/40">
        <StoreControlDashboard initial={snapshot} />
      </div>
    </div>
  );
}
