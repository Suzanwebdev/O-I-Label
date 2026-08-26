"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Plus, Store } from "lucide-react";
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
  "/admin/reviews": { title: "Reviews" },
  "/admin/homepage": { title: "Homepage" },
  "/admin/discounts": { title: "Discounts", ctaHref: "/admin/discounts#create-discount", ctaLabel: "New code" },
  "/admin/marketing": { title: "Marketing" },
  "/admin/newsletter": { title: "Newsletter" },
  "/admin/support-crm": { title: "Support CRM" },
  "/admin/website-health": { title: "Website Health" },
  "/admin/team-roles": { title: "Team & Roles" },
  "/admin/store-control": { title: "Store Control" },
  "/admin/settings": { title: "Settings" },
  "/admin/feature-flags": { title: "Feature Flags" },
  "/admin/restock-demand": { title: "Restock Demand" },
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

type Props = {
  onOpenMobileNav?: () => void;
};

export function AdminTopbar({ onOpenMobileNav }: Props) {
  const pathname = usePathname();
  const meta = resolveMeta(pathname);

  return (
    <header className="admin-topbar sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center justify-between gap-2 px-4 md:gap-0 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none md:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-neutral-700 hover:bg-neutral-100 hover:text-black md:hidden"
            aria-label="Open admin menu"
            onClick={onOpenMobileNav}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <p className="min-w-0 truncate font-serif-display text-base font-semibold tracking-tight text-black md:truncate-none">
            {meta.title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          {meta.ctaHref && meta.ctaLabel ? (
            <Button asChild size="sm" className="rounded-full bg-black text-white hover:bg-neutral-800">
              <Link href={meta.ctaHref} className="gap-1" aria-label={meta.ctaLabel}>
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">{meta.ctaLabel}</span>
              </Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="text-neutral-700 hover:bg-neutral-100 hover:text-black"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Link
            href="/"
            aria-label="View storefront"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-black md:hidden"
          >
            <Store className="h-4 w-4" />
          </Link>
          <Link href="/" className="hidden text-xs text-neutral-600 hover:text-black md:inline">
            View storefront
          </Link>
        </div>
      </div>
    </header>
  );
}
