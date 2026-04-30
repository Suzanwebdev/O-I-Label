import { getSuperadminPaymentsSnapshot } from "@/lib/data/superadmin";

export default async function SuperadminPaymentsPage() {
  const snapshot = await getSuperadminPaymentsSnapshot();
  const paymentSummary = [
    { label: "Successful payments (7d)", value: snapshot.successful7d.toString() },
    { label: "Failed payments (7d)", value: snapshot.failed7d.toString() },
    { label: "Gross paid volume (7d)", value: `GHc ${snapshot.gross7d.toFixed(2)}` },
    { label: "Avg paid amount (7d)", value: `GHc ${snapshot.avgPaidAmount7d.toFixed(2)}` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl text-white md:text-3xl">Payments</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Monitor provider health, settlement posture, and transaction quality indicators.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {paymentSummary.map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-wide text-white/55">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Provider status</h2>
        <ul className="mt-4 space-y-3">
          {snapshot.providers.map((provider) => (
            <li
              key={provider.name}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <div>
                <p className="font-medium text-white">{provider.name}</p>
                <p className="text-sm text-white/55">{provider.note}</p>
              </div>
              <span className="rounded-full border border-white/20 px-2.5 py-1 text-xs text-white/70">
                {provider.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
