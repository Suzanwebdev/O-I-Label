import { getSuperadminExportsSnapshot } from "@/lib/data/superadmin";

export default async function SuperadminExportsPage() {
  const snapshot = await getSuperadminExportsSnapshot();
  const jobs = [
    {
      name: `Orders (${snapshot.orders30d} rows, last 30 days)`,
      format: "CSV",
      cadence: "On demand",
      status: "Ready",
    },
    {
      name: `Payments (${snapshot.payments30d} rows, last 30 days)`,
      format: "CSV",
      cadence: "On demand",
      status: "Ready",
    },
    {
      name: `Customer base (${snapshot.usersTotal} profiles)`,
      format: "JSON",
      cadence: "Weekly",
      status: snapshot.failedWebhooks7d > 0 ? "Review" : "Ready",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl text-white md:text-3xl">Exports</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Prepare reporting extracts for finance, operations, and compliance teams.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Scheduled export jobs</h2>
        <ul className="mt-4 space-y-3">
          {jobs.map((job) => (
            <li
              key={job.name}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-white">{job.name}</p>
                <p className="text-white/55">
                  {job.format} • {job.cadence}
                </p>
              </div>
              <span className="rounded-full border border-white/20 px-2.5 py-1 text-xs text-white/70">
                {job.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
