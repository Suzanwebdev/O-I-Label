"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type RouteMeta = {
  title: string;
  ctaHref?: string;
  ctaLabel?: string;
};

const routeMeta: Record<string, RouteMeta> = {
  "/admin": { title: "Dashboard" },
  "/admin/analytics": { title: "Analytics" },
  "/admin/pos": { title: "POS" },
  "/admin/products": { title: "Products", ctaHref: "/admin/products/new", ctaLabel: "Add Product" },
  "/admin/orders": { title: "Orders" },
  "/admin/customers": { title: "Customers" },
  "/admin/categories": { title: "Categories" },
  "/admin/collections": { title: "Collections" },
  "/admin/inventory": { title: "Inventory" },
  "/admin/blog": { title: "Blog" },
  "/admin/homepage": { title: "Homepage" },
  "/admin/discounts": { title: "Discounts" },
  "/admin/marketing": { title: "Marketing" },
  "/admin/support-crm": { title: "Support CRM" },
  "/admin/team-roles": { title: "Team & Roles" },
  "/admin/settings": { title: "Settings" },
  "/admin/feature-flags": { title: "Feature Flags" },
};

function resolveMeta(pathname: string): RouteMeta {
  if (routeMeta[pathname]) return routeMeta[pathname];
  if (pathname.startsWith("/admin/products/new")) return { title: "New Product" };
  const editProductMatch = /^\/admin\/products\/([^/]+)$/.exec(pathname);
  if (editProductMatch && editProductMatch[1] !== "new") {
    return { title: "Edit Product" };
  }
  return { title: "Admin" };
}

export function AdminTopbar() {
  const pathname = usePathname();
  const meta = resolveMeta(pathname);

  return (
    <header className="admin-topbar sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <p className="font-serif-display text-base font-semibold tracking-tight text-black">{meta.title}</p>
        <div className="flex items-center gap-2">
          {meta.ctaHref && meta.ctaLabel ? (
            <Button asChild size="sm" className="rounded-full bg-black text-white hover:bg-neutral-800">
              <Link href={meta.ctaHref} className="gap-1">
                <Plus className="h-4 w-4" />
                {meta.ctaLabel}
              </Link>
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="Notifications" className="text-neutral-700 hover:bg-neutral-100 hover:text-black">
            <Bell className="h-4 w-4" />
          </Button>
          <Link href="/" className="text-xs text-neutral-600 hover:text-black">
            View storefront
          </Link>
        </div>
      </div>
    </header>
  );
}

