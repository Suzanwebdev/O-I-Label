"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MessageSquareText,
  Megaphone,
  Percent,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    title: "Main",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/pos", label: "POS", icon: ShoppingBasket },
      { href: "/admin/products", label: "Products", icon: ShoppingBag },
      { href: "/admin/orders", label: "Orders", icon: ClipboardList },
      { href: "/admin/customers", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/categories", label: "Categories", icon: Boxes },
      { href: "/admin/collections", label: "Collections", icon: Store },
      { href: "/admin/inventory", label: "Inventory", icon: Workflow },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/blog", label: "Blog", icon: MessageSquareText },
      { href: "/admin/homepage", label: "Homepage", icon: Store },
      { href: "/admin/discounts", label: "Discounts", icon: Percent },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
      { href: "/admin/support-crm", label: "Support CRM", icon: UsersRound },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/team-roles", label: "Team & Roles", icon: ShieldCheck },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/feature-flags", label: "Feature Flags", icon: Workflow },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar w-64 shrink-0 border-r border-neutral-800 bg-black text-white">
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="font-serif-display text-lg font-semibold tracking-tight text-white">O & I Label</p>
          <p className="admin-sidebar-brand-sub mt-1 text-xs text-neutral-400">Admin</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="admin-sidebar-group-label px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                {group.title}
              </p>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "admin-sidebar-link flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "admin-sidebar-link--active bg-white font-medium text-black" : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

