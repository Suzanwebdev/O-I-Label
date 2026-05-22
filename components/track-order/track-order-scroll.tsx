"use client";

import * as React from "react";

/** Scroll to status block after server redirect with query params. */
export function TrackOrderScrollAnchor({ active }: { active: boolean }) {
  React.useEffect(() => {
    if (!active) return;
    const el = document.getElementById("track-order-status");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [active]);

  return null;
}
