"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AdminNavMenu } from "@/components/admin/admin-nav-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminMobileNav({ open, onOpenChange }: Props) {
  const pathname = usePathname();

  React.useEffect(() => {
    onOpenChange(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- close drawer after navigation

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="admin-sidebar flex w-[min(100vw,16rem)] max-w-[16rem] flex-col gap-0 overflow-hidden border-[#1a1a1a] bg-[#000000] p-0 text-white md:hidden [&>button]:text-white [&>button]:hover:text-white"
        style={{ backgroundColor: "#000000" }}
      >
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>
        <AdminNavMenu pathname={pathname} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
