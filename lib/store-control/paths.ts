const STORE_PATH_PREFIXES = [
  "/",
  "/shop",
  "/product",
  "/cart",
  "/checkout",
  "/account",
  "/blog",
  "/about",
  "/contact",
  "/track-order",
  "/policies",
  "/login",
  "/signup",
];

export function isStorefrontPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return STORE_PATH_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
}

export function isAlwaysAllowedPath(pathname: string): boolean {
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/superadmin") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/newsletter") ||
    pathname.startsWith("/api/store-control") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/closed") ||
    pathname.startsWith("/maintenance")
  ) {
    return true;
  }
  return false;
}

export function isCheckoutApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/checkout");
}
