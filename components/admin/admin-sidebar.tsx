"use client";

import { usePathname } from "next/navigation";
import { AdminNavMenu } from "@/components/admin/admin-nav-menu";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="admin-sidebar hidden w-64 shrink-0 border-r border-[#1a1a1a] bg-[#000000] text-white md:block"
      style={{ backgroundColor: "#000000" }}
    >
      <div
        className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[#000000]"
        style={{ backgroundColor: "#000000" }}
      >
        <AdminNavMenu pathname={pathname} />
      </div>
    </aside>
  );
}
