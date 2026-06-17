import { NextResponse } from "next/server";
import { sendStoreWaitlistWelcomeEmail } from "@/lib/email/resend";
import { resolveNewsletterPhone } from "@/lib/newsletter/subscribe-utils";
import { joinStoreWaitlist, normalizeWaitlistEmail } from "@/lib/store-control/waitlist";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "store-control:waitlist", 15);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    firstName?: unknown;
    email?: unknown;
    phoneLocal?: unknown;
    countryIso?: unknown;
    source?: unknown;
    productSlug?: unknown;
  };

  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const phoneLocal = typeof b.phoneLocal === "string" ? b.phoneLocal.trim() : "";
  const countryIso = typeof b.countryIso === "string" ? b.countryIso.trim().toUpperCase() : "GH";
  const source = typeof b.source === "string" && b.source.trim() ? b.source.trim().slice(0, 64) : "presale";
  const productSlug =
    typeof b.productSlug === "string" && b.productSlug.trim() ? b.productSlug.trim() : null;

  let phoneE164: string | null = null;
  if (phoneLocal) {
    const phoneResolved = resolveNewsletterPhone(countryIso, phoneLocal);
    if ("error" in phoneResolved) {
      return NextResponse.json({ error: phoneResolved.error }, { status: 400 });
    }
    phoneE164 = phoneResolved.phoneE164;
  }

  const result = await joinStoreWaitlist({
    firstName,
    email,
    phoneE164,
    countryIso,
    source,
    productSlug,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let welcomeEmail: "sent" | "skipped" | "disabled" = "skipped";
  if (!result.updated && process.env.STORE_WAITLIST_WELCOME_EMAIL !== "0") {
    const welcome = await sendStoreWaitlistWelcomeEmail({ to: email, firstName });
    if ("sent" in welcome && welcome.sent) {
      welcomeEmail = "sent";
      try {
        const service = createServiceRoleClient();
        await service
          .from("store_waitlist")
          .update({ welcome_email_sent_at: new Date().toISOString() })
          .eq("email_normalized", normalizeWaitlistEmail(email));
      } catch {
        /* non-fatal */
      }
    }
  }

  return NextResponse.json({ ok: true, updated: result.updated, welcomeEmail });
}
