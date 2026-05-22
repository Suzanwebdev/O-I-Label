import { PaymentsPeriodFilter } from "@/components/superadmin/payments-period-filter";
import { PaymentsTransactionsTable } from "@/components/superadmin/payments-transactions-table";
import { getSuperadminPaymentsSnapshot } from "@/lib/data/superadmin";

type Props = {
  searchParams: Promise<{ period?: string }>;
};

export default async function SuperadminPaymentsPage({ searchParams }: Props) {
  const { period: periodParam } = await searchParams;
  const snapshot = await getSuperadminPaymentsSnapshot(periodParam);

  const paymentSummary = [
    { label: "Successful payments", value: snapshot.successful.toString() },
    { label: "Failed / refunded", value: snapshot.failed.toString() },
    { label: "Pending / processing", value: snapshot.pending.toString() },
    { label: "Gross paid volume", value: `GHc ${snapshot.gross.toFixed(2)}` },
    { label: "Avg paid amount", value: `GHc ${snapshot.avgPaidAmount.toFixed(2)}` },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="font-serif-display text-2xl text-white md:text-3xl">Payments</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
            Monitor provider health, settlement posture, and transaction quality indicators.
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-white/45">
            Showing: <span className="text-white/75">{snapshot.periodLabel}</span>
          </p>
        </div>
        <PaymentsPeriodFilter active={snapshot.period} />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {paymentSummary.map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-wide text-white/55">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Transactions</h2>
            <p className="mt-1 text-sm text-white/55">
              {snapshot.transactions.length} record{snapshot.transactions.length === 1 ? "" : "s"} ·{" "}
              {snapshot.periodLabel}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <PaymentsTransactionsTable rows={snapshot.transactions} periodLabel={snapshot.periodLabel} />
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Provider status</h2>
        <p className="mt-1 text-sm text-white/55">Gateway toggles (not filtered by period)</p>
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
