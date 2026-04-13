import { SuperadminPageHeader } from "@/components/superadmin/superadmin-page-header";

export default function SuperAdminSecurityPage() {
  return (
    <div>
      <SuperadminPageHeader
        title="Security"
        description="Hardening happens in layers: HTTPS, Supabase Row Level Security, server-only secrets, and sensible rate limits at the edge."
      />
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-medium text-white">API rate limits</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            A per-minute limit can be stored with store settings and enforced in middleware or at your API
            gateway. Tune it before high-traffic launches.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-medium text-white">Audit trail</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Sensitive actions should append to an immutable audit trail. Failed sign-ins and admin changes are
            good candidates for the next iteration.
          </p>
        </div>
      </div>
    </div>
  );
}
