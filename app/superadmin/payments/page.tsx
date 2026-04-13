import Link from "next/link";
import { SuperadminPageHeader } from "@/components/superadmin/superadmin-page-header";

export default function SuperAdminPaymentsPage() {
  return (
    <div>
      <SuperadminPageHeader
        title="Payments"
        description="Watch checkout health: provider mix, stuck intents, and webhook delivery. Enable or disable providers from the control center."
      />
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/75">
        <p className="leading-relaxed">
          For live payment and webhook rows, open your Supabase project → Table Editor, or add reporting views
          here when you connect read-only queries.
        </p>
        <p className="mt-4">
          <Link
            href="/superadmin"
            className="font-medium text-white underline underline-offset-2 hover:text-white/90"
          >
            Control center
          </Link>{" "}
          has toggles for Moolre, Paystack, and Flutterwave.
        </p>
      </div>
    </div>
  );
}
