import { type NextRequest, NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { observeOperationalEvent } from "@/lib/errors/capture-event";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/seo/site";

function redirectTo(path: string, request: NextRequest) {
  const origin = getSiteUrl() || request.nextUrl.origin;
  return NextResponse.redirect(new URL(path, origin));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeRedirectPath(url.searchParams.get("next") ?? undefined, "/account");

  const authError = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (authError) {
    console.warn("[auth/callback] provider error:", authError, errorDescription ?? "");
    observeOperationalEvent({
      severity: "warning",
      category: "auth",
      surface: "storefront",
      code: `callback_provider_${stabilizeAuthCode(authError)}`,
      message: "Authentication callback received a provider error",
      metadata: { provider_error: stabilizeAuthCode(authError) },
    });
    return redirectTo("/login?notice=auth_failed", request);
  }

  const code = url.searchParams.get("code");
  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn("[auth/callback] exchange failed:", error.message);
        observeOperationalEvent({
          severity: "error",
          category: "auth",
          surface: "storefront",
          code: "callback_exchange_failed",
          message: "Authentication code exchange failed",
          metadata: { outcome: "exchange_failed" },
        });
        return redirectTo("/login?notice=auth_failed", request);
      }
    } catch (err) {
      console.warn("[auth/callback] exchange exception:", err);
      observeOperationalEvent({
        severity: "error",
        category: "auth",
        surface: "storefront",
        code: "callback_exchange_exception",
        message: "Authentication callback threw during code exchange",
        metadata: { outcome: "exception" },
      });
      return redirectTo("/login?notice=auth_failed", request);
    }
  }

  return redirectTo(next, request);
}

function stabilizeAuthCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 48) || "unknown";
}
