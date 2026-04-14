"use client";

import * as React from "react";

export function ScrollProgress() {
  React.useEffect(() => {
    let raf = 0;
    const root = document.documentElement;

    const update = () => {
      const scrollTop = root.scrollTop || document.body.scrollTop;
      const max = root.scrollHeight - root.clientHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
      root.style.setProperty("--scroll-progress", String(progress));
      raf = 0;
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-foreground/75"
      style={{ transform: "scaleX(var(--scroll-progress, 0))" }}
    />
  );
}

