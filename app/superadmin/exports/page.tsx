import Link from "next/link";
import { SuperadminPageHeader } from "@/components/superadmin/superadmin-page-header";

const exportsList = [
  { href: "/api/admin/export?type=orders", label: "Orders", hint: "Recent orders and totals" },
  { href: "/api/admin/export?type=customers", label: "Customers", hint: "Signed-in shoppers" },
  { href: "/api/admin/export?type=products", label: "Products", hint: "Catalog and variants" },
] as const;

export default function SuperAdminExportsPage() {
  return (
    <div>
      <SuperadminPageHeader
        title="Data export"
        description="Download CSV snapshots for operations and accounting. Exports require superadmin access."
      />
      <ul className="grid gap-3 sm:grid-cols-1 md:max-w-xl">
        {exportsList.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex flex-col rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 transition-colors hover:border-white/25 hover:bg-white/[0.07]"
            >
              <span className="font-medium text-white">{item.label}</span>
              <span className="mt-1 text-xs text-white/55">{item.hint}</span>
              <span className="mt-2 text-sm text-white/70">Download CSV →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
