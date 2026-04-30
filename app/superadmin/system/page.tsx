import { getSuperadminSystemSnapshot } from "@/lib/data/superadmin";

const maintenanceChecklist = [
  "Confirm storefront banner and status page notice",
  "Pause campaign traffic and affiliate links",
  "Verify webhook retry queue is drained",
  "Run post-maintenance smoke tests",
];

export default async function SuperadminSystemPage() {
  const snapshot = await getSuperadminSystemSnapshot();
  const incidents = [
    {
      service: "Order intake",
      metric: `${snapshot.pendingOrders} pending`,
      status: snapshot.pendingOrders > 20 ? "Monitor" : "Healthy",
    },
    {
      service: "Fulfillment queue",
      metric: `${snapshot.processingOrders} processing`,
      status: snapshot.processingOrders > 30 ? "Monitor" : "Healthy",
    },
    {
      service: "Webhook processing",
      metric: `${snapshot.webhookErrors24h} errors (24h)`,
      status: snapshot.webhookErrors24h > 0 ? "Monitor" : "Healthy",
    },
    {
      service: "Application errors",
      metric: `${snapshot.appErrors24h} errors (24h)`,
      status: snapshot.appErrors24h > 0 ? "Monitor" : "Healthy",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl text-white md:text-3xl">System</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Track platform health and operational readiness before high-traffic campaigns.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Service health snapshot</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm text-white/80">
            <thead className="text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Current metric</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((row) => (
                <tr key={row.service} className="border-t border-white/10">
                  <td className="px-3 py-3 font-medium text-white">{row.service}</td>
                  <td className="px-3 py-3">{row.metric}</td>
                  <td className="px-3 py-3">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Maintenance runbook</h2>
        <ol className="mt-4 space-y-2 text-sm text-white/75">
          {maintenanceChecklist.map((step) => (
            <li key={step} className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5">
              {step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
