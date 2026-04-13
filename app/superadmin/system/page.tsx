import { SuperadminPageHeader } from "@/components/superadmin/superadmin-page-header";

export default function SuperAdminSystemPage() {
  return (
    <div>
      <SuperadminPageHeader
        title="System health"
        description="Monitor reliability and performance from your hosting provider and Supabase dashboards. This page is the home for future built-in diagnostics."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-medium text-white">Errors & logs</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Use Supabase Logs and your host’s runtime logs for stack traces. A structured error inbox can be
            added here later.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-medium text-white">Performance</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Connect analytics (for example Vercel Speed Insights or OpenTelemetry) when you move to
            production traffic.
          </p>
        </div>
      </div>
    </div>
  );
}
