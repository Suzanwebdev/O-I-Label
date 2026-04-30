import { getSuperadminSecuritySnapshot } from "@/lib/data/superadmin";

export default async function SuperadminSecurityPage() {
  const snapshot = await getSuperadminSecuritySnapshot();
  const controls = [
    {
      title: "Privileged users",
      value: `${snapshot.superadmins} superadmins / ${snapshot.admins} admins / ${snapshot.staff} staff`,
      status: "Active",
    },
    {
      title: "Audit activity (7d)",
      value: `${snapshot.auditEvents7d} events logged`,
      status: "Active",
    },
    {
      title: "Signature failures (7d)",
      value: `${snapshot.badSignatures7d} webhook failures`,
      status: snapshot.badSignatures7d > 0 ? "Review" : "Active",
    },
    { title: "Session timeout", value: "30 minutes idle", status: "Active" },
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl text-white md:text-3xl">Security</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          Track access controls, hardening policies, and incident preparedness for privileged workflows.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {controls.map((control) => (
          <article key={control.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-wide text-white/55">{control.title}</p>
            <p className="mt-2 text-base font-semibold text-white">{control.value}</p>
            <p className="mt-2 text-sm text-white/65">{control.status}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-base font-semibold text-white">Recent audit activity</h2>
        <ul className="mt-4 space-y-2 text-sm text-white/75">
          {snapshot.recentAuditActions.map((item) => (
            <li
              key={`${item.action}-${item.created_at}`}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5"
            >
              <div className="font-medium text-white">{item.action}</div>
              <div className="text-xs text-white/60">{new Date(item.created_at).toLocaleString()}</div>
            </li>
          ))}
          {snapshot.recentAuditActions.length === 0 ? (
            <li className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-white/60">
              No recent audit events.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
