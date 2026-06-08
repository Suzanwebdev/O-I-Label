"use client";

import { useStoreControl } from "@/components/store-control/store-control-provider";
import { CountdownDisplay } from "@/components/store-control/countdown-display";

export function PresaleLaunchStrip() {
  const control = useStoreControl();
  if (control.storeStatus !== "presale" || !control.countdownEnabled || !control.countdownTarget) {
    return null;
  }

  return (
    <div className="border-b border-border bg-[#faf8f5] px-4 py-4">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Presale preview</p>
        <p className="mt-1 font-serif-display text-lg text-foreground">{control.maintenanceMessage}</p>
        <CountdownDisplay
          targetIso={control.countdownTarget}
          className="mx-auto mt-4 max-w-md"
          label="Opens in"
        />
      </div>
    </div>
  );
}
