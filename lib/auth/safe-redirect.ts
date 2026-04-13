/** Allow only same-site relative redirects after login (blocks open redirects). */
export function safeRedirectPath(next: string | undefined, fallback = "/admin"): string {
  if (!next || typeof next !== "string") return fallback;
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  if (t.includes("://") || t.includes("\\") || t.includes("@")) return fallback;
  if (t.length > 512) return fallback;
  return t;
}
