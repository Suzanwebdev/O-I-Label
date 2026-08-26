import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getRequestAuthz } from "@/lib/authz";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authz = await getRequestAuthz();
  if (!authz.user) {
    redirect("/login?next=/admin");
  }
  if (!authz.isAdmin) {
    redirect("/login?next=/admin&notice=no_access");
  }

  return <AdminShell>{children}</AdminShell>;
}
