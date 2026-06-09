import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { STORE_ACCESS_COOKIE } from "@/lib/store-control/constants";
import { ipAllowed } from "@/lib/store-control/access";
import { getStoreControlEdgeCached } from "@/lib/store-control/edge";
import {
  isAlwaysAllowedPath,
  isCheckoutApiPath,
  isStorefrontPath,
} from "@/lib/store-control/paths";

function hasPrivateAccessCookie(request: NextRequest): boolean {
  const v = request.cookies.get(STORE_ACCESS_COOKIE)?.value;
  return Boolean(v && v.length >= 16);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAlwaysAllowedPath(pathname)) {
    return updateSession(request);
  }

  const { control, settings } = await getStoreControlEdgeCached();

  if (isCheckoutApiPath(pathname) && !control.checkoutAllowed) {
    return NextResponse.json(
      { error: control.maintenanceMessage, code: "store_checkout_disabled" },
      { status: 503, headers: { "Retry-After": "3600" } }
    );
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");
  const ipWhitelisted = ipAllowed(clientIp, settings.private_access_ips);
  const privateOk =
    !control.requiresPrivateAccess || hasPrivateAccessCookie(request) || ipWhitelisted;

  if (control.requiresPrivateAccess && isStorefrontPath(pathname) && !privateOk) {
    const url = request.nextUrl.clone();
    url.pathname = "/closed/private-access";
    const res = NextResponse.rewrite(url);
    res.headers.set("Retry-After", "3600");
    return res;
  }

  if (!control.browsingAllowed && isStorefrontPath(pathname)) {
    const slug = control.closedPageSlug ?? "maintenance";
    const url = request.nextUrl.clone();
    url.pathname = `/closed/${slug}`;
    const res = NextResponse.rewrite(url);
    const use503 =
      control.storeStatus === "maintenance" && Boolean(settings.maintenance_use_503);
    if (use503) {
      return new NextResponse(res.body, {
        status: 503,
        headers: {
          ...Object.fromEntries(res.headers.entries()),
          "Retry-After": "3600",
        },
      });
    }
    res.headers.set("Retry-After", "3600");
    return res;
  }

  if (
    !control.checkoutAllowed &&
    (pathname === "/checkout" || pathname.startsWith("/checkout/"))
  ) {
    const url = request.nextUrl.clone();
    if (control.storeStatus === "soft_close") {
      url.pathname = "/";
      const res = NextResponse.redirect(url);
      return res;
    }
    url.pathname =
      control.storeStatus === "presale"
        ? "/closed/presale"
        : `/closed/${control.closedPageSlug ?? "maintenance"}`;
    return NextResponse.rewrite(url);
  }

  if (
    control.softCloseMode &&
    (pathname === "/cart" || pathname.startsWith("/cart/"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
