"use client";

import * as React from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function CountdownDisplay({
  targetIso,
  className,
  label = "Launching in",
}: {
  targetIso: string;
  className?: string;
  label?: string;
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

  return (
    <div className={className}>
      <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {units.map((u) => (
          <div
            key={u.label}
            className="rounded-[var(--radius-md)] border border-border bg-background/80 px-2 py-3 text-center shadow-[var(--shadow-soft)]"
          >
            <p className="font-serif-display text-2xl leading-none text-foreground sm:text-3xl">
              {pad(u.value)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{u.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
