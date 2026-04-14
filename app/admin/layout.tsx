import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { getRequestAuthz } from "@/lib/authz";

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

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <AdminTopbar />
      <div className="flex">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
