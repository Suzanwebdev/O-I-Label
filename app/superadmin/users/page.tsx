import Link from "next/link";
import { SuperadminPageHeader } from "@/components/superadmin/superadmin-page-header";

export default function SuperAdminUsersPage() {
  return (
    <div>
      <SuperadminPageHeader
        title="Users & access"
        description="Who can open the store admin and this platform console is controlled in your database alongside Supabase Authentication. Invite users in Auth, then grant roles here when you are ready to wire this screen to live data."
      />
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/75">
        <p className="font-medium text-white">Typical roles</p>
        <ul className="mt-3 list-inside list-disc space-y-2 leading-relaxed">
          <li>
            <span className="font-medium text-white/90">Superadmin</span> — full platform access (you).
          </li>
          <li>
            <span className="font-medium text-white/90">Admin / staff</span> — catalog, orders, and day-to-day
            store operations in{" "}
            <Link href="/admin" className="text-white underline underline-offset-2 hover:text-white/90">
              Store admin
            </Link>
            .
          </li>
          <li>
            <span className="font-medium text-white/90">Customers</span> — shoppers; no admin routes.
          </li>
        </ul>
        <p className="mt-5 text-xs text-white/50">
          Until a user directory ships here, manage records in the Supabase Table Editor for your project.
        </p>
      </div>
    </div>
  );
}
