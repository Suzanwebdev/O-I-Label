import { type NextRequest, NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next") ?? undefined, "/account");

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      return NextResponse.redirect(new URL("/login?notice=auth_failed", request.url));
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
