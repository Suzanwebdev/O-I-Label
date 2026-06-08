import { type NextRequest, NextResponse } from "next/server";
import {
  isPathAllowedDuringStorefrontClosed,
  resolveStorefrontClosedDisplay,
} from "@/lib/storefront-closed";
import { fetchStorefrontClosedSettingsEdge } from "@/lib/storefront-closed-edge";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/maintenance")) {
    return updateSession(request);
  }

  const storefront = await fetchStorefrontClosedSettingsEdge();
  if (storefront?.maintenance_mode) {
    if (pathname.startsWith("/api/checkout")) {
      const display = resolveStorefrontClosedDisplay(storefront);
      return NextResponse.json(
        {
          error: "The storefront is temporarily closed.",
          code: "storefront_closed",
          preset: display.preset,
        },
        { status: 503 }
      );
    }

    if (!isPathAllowedDuringStorefrontClosed(pathname)) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

