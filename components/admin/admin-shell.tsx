"use client";

import * as React from "react";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

type Props = {
  children: React.ReactNode;
};

export function AdminShell({ children }: Props) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div
      data-admin-layout
      className="admin-layout-root min-h-screen bg-neutral-50 text-foreground max-md:overflow-x-hidden"
    >
      <AdminTopbar onOpenMobileNav={() => setMobileNavOpen(true)} />
      <div className="flex max-md:min-w-0">
        <AdminSidebar />
        <AdminMobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
        <main className="min-w-0 w-full flex-1 bg-neutral-50 px-4 py-6 max-md:overflow-x-hidden md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
