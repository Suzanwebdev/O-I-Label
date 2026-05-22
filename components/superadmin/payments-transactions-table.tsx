import type { SuperadminPaymentRow } from "@/lib/data/superadmin";

function statusClass(status: string) {
  if (status === "paid") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (status === "failed") return "border-red-400/30 bg-red-500/10 text-red-200";
  if (status === "refunded") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (status === "processing") return "border-blue-400/30 bg-blue-500/10 text-blue-200";
  return "border-white/20 bg-white/[0.04] text-white/70";
}

export function PaymentsTransactionsTable({
  rows,
  periodLabel,
}: {
  rows: SuperadminPaymentRow[];
  periodLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-white/55">
        No payment records for <span className="text-white/80">{periodLabel}</span>.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
            <th className="px-3 py-3 font-medium">Date</th>
            <th className="px-3 py-3 font-medium">Order</th>
            <th className="px-3 py-3 font-medium">Provider</th>
            <th className="px-3 py-3 font-medium">Reference</th>
            <th className="px-3 py-3 font-medium text-right">Amount</th>
            <th className="px-3 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
            >
              <td className="whitespace-nowrap px-3 py-3 text-white/80">
                {new Date(row.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-3 font-medium text-white">
                {row.order_number ?? row.order_id.slice(0, 8)}
              </td>
              <td className="px-3 py-3 capitalize text-white/80">{row.provider}</td>
              <td className="max-w-[140px] truncate px-3 py-3 font-mono text-xs text-white/60">
                {row.reference ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-white">
                GHc {row.amount_ghs.toFixed(2)}
              </td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(row.status)}`}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length >= 500 ? (
        <p className="mt-3 text-xs text-white/45">
          Showing the latest 500 transactions in this period. Narrow the range for more detail.
        </p>
      ) : null}
    </div>
  );
}
