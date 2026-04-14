"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SUPERADMIN_NAV } from "@/lib/superadmin/nav";

function linkClass(active: boolean) {
  return cn(
    "block rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors",
    active
      ? "bg-white font-medium text-black"
      : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
  );
}

export function SuperAdminAsideNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-52 shrink-0 md:block">
      <nav className="space-y-0.5">
        {SUPERADMIN_NAV.map((n) => {
          const active =
            n.href === "/superadmin"
              ? pathname === "/superadmin"
              : pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link key={n.href} href={n.href} className={linkClass(active)}>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function SuperAdminMobileNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-white/10 md:hidden">
      <div className="flex gap-1 overflow-x-auto px-4 py-2">
        {SUPERADMIN_NAV.map((n) => {
          const active =
            n.href === "/superadmin"
              ? pathname === "/superadmin"
              : pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-white text-black" : "bg-neutral-800 text-white hover:bg-neutral-700"
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
