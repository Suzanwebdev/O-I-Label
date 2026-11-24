"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function CountdownDisplay({
  targetIso,
  className,
  label = "Launching in",
  tone = "default",
}: {
  targetIso: string;
  className?: string;
  label?: string;
  /** `onMedia` keeps units legible over a full-bleed photograph. */
  tone?: "default" | "onMedia";
}) {
  const target = React.useMemo(() => Date.parse(targetIso), [targetIso]);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  if (!Number.isFinite(target) || diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const units = [
    { label: "Days", value: days },
    { label: "Hours", value: hours },
    { label: "Minutes", value: minutes },
    { label: "Seconds", value: seconds },
  ];

  const onMedia = tone === "onMedia";

  return (
    <div className={className}>
      <p
        className={cn(
          "mb-3 text-[10px] uppercase tracking-[0.2em]",
          onMedia ? "text-white/70" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {units.map((u) => (
          <div
            key={u.label}
            className={cn(
              "rounded-[var(--radius-md)] px-2 py-3 text-center",
              onMedia
                ? "border border-white/25 bg-white/10 backdrop-blur-[2px]"
                : "border border-border bg-background/80 shadow-[var(--shadow-soft)]"
            )}
          >
            <p
              className={cn(
                "font-serif-display text-2xl leading-none sm:text-3xl",
                onMedia ? "text-white" : "text-foreground"
              )}
            >
              {pad(u.value)}
            </p>
            <p
              className={cn(
                "mt-1 text-[10px] uppercase tracking-[0.16em]",
                onMedia ? "text-white/65" : "text-muted-foreground"
              )}
            >
              {u.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
