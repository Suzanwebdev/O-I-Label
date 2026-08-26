import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  BellRing,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MessageSquareText,
  Megaphone,
  Mail,
  Percent,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingBag,
  ShoppingBasket,
  Star,
  Store,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
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
      { href: "/admin/restock-demand", label: "Restock Demand", icon: BellRing },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/blog", label: "Blog", icon: MessageSquareText },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
      { href: "/admin/homepage", label: "Homepage", icon: Store },
      { href: "/admin/discounts", label: "Discounts", icon: Percent },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
      { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
      { href: "/admin/support-crm", label: "Support CRM", icon: UsersRound },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/website-health", label: "Website Health", icon: Activity },
      { href: "/admin/team-roles", label: "Team & Roles", icon: ShieldCheck },
      { href: "/admin/store-control", label: "Store Control", icon: SlidersHorizontal },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/feature-flags", label: "Feature Flags", icon: Workflow },
    ],
  },
];

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
