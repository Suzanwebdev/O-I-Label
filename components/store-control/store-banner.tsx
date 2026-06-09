"use client";

import Link from "next/link";
import { useStoreControl } from "@/components/store-control/store-control-provider";

export function StoreAnnouncementBanner() {
  const control = useStoreControl();
  const items = control.activeBanners.length
    ? control.activeBanners
    : control.bannerEnabled && control.bannerText
      ? [{ id: "legacy", text: control.bannerText, href: null }]
      : [];

  if (!items.length) return null;

  return (
    <div className="border-b border-border bg-[#0a0a0a]">
      {items.map((item) => (
        <div
          key={item.id}
          className="border-b border-white/10 px-4 py-2.5 text-center text-[11px] tracking-[0.06em] text-white last:border-b-0 sm:text-xs"
        >
          {item.href ? (
            <Link href={item.href} className="inline-flex items-center justify-center gap-1 hover:underline">
              {item.text}
            </Link>
          ) : (
            <span>{item.text}</span>
          )}
        </div>
      ))}
    </div>
  );
}
