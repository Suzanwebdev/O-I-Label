"use client";

import { useStoreControl } from "@/components/store-control/store-control-provider";

export function SoftCloseBanner() {
  const control = useStoreControl();
  if (!control.softCloseMode) return null;

  return (
    <div className="border-b border-amber-200/60 bg-[#faf6f0] px-4 py-3 text-center">
      <p className="text-[11px] leading-relaxed tracking-[0.04em] text-foreground/90 sm:text-xs">
        {control.maintenanceMessage ||
          "Purchasing is temporarily unavailable while we prepare our next edit."}
      </p>
    </div>
  );
}
