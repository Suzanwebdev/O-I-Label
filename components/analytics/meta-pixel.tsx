"use client";

import * as React from "react";
import Script from "next/script";
import { trackMetaPageView } from "@/lib/analytics/meta";
import {
  META_BOOTSTRAP_PAGE_VIEW_FLAG,
  resolveMetaActivationPageView,
} from "@/lib/analytics/meta-pixel-activation";
import { canUseMarketing } from "@/lib/consent/storage";

declare global {
  interface Window {
    [META_BOOTSTRAP_PAGE_VIEW_FLAG]?: boolean;
  }
}

/**
 * Loads Meta Pixel once and ensures a single activation PageView per marketing
 * mount. Does not delete or recreate window.fbq on revoke/re-enable.
 */
export function StoreMetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

  React.useEffect(() => {
    if (!pixelId) return;
    if (typeof window === "undefined") return;

    const action = resolveMetaActivationPageView({
      bootstrapFlag: Boolean(window[META_BOOTSTRAP_PAGE_VIEW_FLAG]),
      fbqAvailable: typeof window.fbq === "function",
      marketingAllowed: canUseMarketing(),
    });

    if (action === "consume-bootstrap") {
      window[META_BOOTSTRAP_PAGE_VIEW_FLAG] = false;
      return;
    }

    if (action === "fire") {
      trackMetaPageView();
    }
  }, [pixelId]);

  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){
            var hadFbq=!!f.fbq;
            if(!f.fbq){
              n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)
            }
            fbq('init','${pixelId}');
            if(!hadFbq){
              fbq('track','PageView');
              f.${META_BOOTSTRAP_PAGE_VIEW_FLAG}=true;
            }
          }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
