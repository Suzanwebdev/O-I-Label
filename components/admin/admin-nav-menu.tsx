"use client";

import Link from "next/link";
import { ADMIN_NAV_GROUPS, isAdminNavActive } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

type Props = {
  pathname: string;
  /** Called after choosing a route (e.g. close the mobile drawer). */
  onNavigate?: () => void;
};

export function AdminNavMenu({ pathname, onNavigate }: Props) {
  return (
    <>
      <div className="border-b border-white/10 bg-[#000000] px-5 py-4" style={{ backgroundColor: "#000000" }}>
        <p className="font-serif-display text-lg font-semibold tracking-tight text-white">O & I Label</p>
        <p className="admin-sidebar-brand-sub mt-1 text-xs text-neutral-400">Admin</p>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#000000] px-3 py-4" style={{ backgroundColor: "#000000" }}>
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="admin-sidebar-group-label px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              {group.title}
            </p>
            <nav className="space-y-1">
              {group.items.map((item) => {
                const active = isAdminNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "admin-sidebar-link flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "admin-sidebar-link--active bg-white font-medium text-black"
                        : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </>
  );
}
