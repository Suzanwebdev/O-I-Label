"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { trackMetaPageView } from "@/lib/analytics/meta";

export function MetaPageViewTracker() {
  const pathname = usePathname();
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    trackMetaPageView();
  }, [pathname]);

  return null;
}
