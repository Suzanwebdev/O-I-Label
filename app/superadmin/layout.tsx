import { redirect } from "next/navigation";
import { Container } from "@/components/store/container";
import { SuperAdminAsideNav, SuperAdminMobileNav } from "@/components/superadmin/superadmin-nav";
import { SuperAdminHeader } from "@/components/superadmin/superadmin-header";
import { getRequestAuthz } from "@/lib/authz";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authz = await getRequestAuthz();
  if (!authz.user) {
    redirect("/login?next=/superadmin");
  }
  if (!authz.isSuperadmin) {
    redirect("/login?next=/superadmin&notice=no_access");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SuperAdminHeader />
      <SuperAdminMobileNav />
      <Container className="flex flex-col gap-8 py-8 md:flex-row md:gap-10">
        <SuperAdminAsideNav />
        <div className="min-w-0 flex-1">{children}</div>
      </Container>
    </div>
  );
}
