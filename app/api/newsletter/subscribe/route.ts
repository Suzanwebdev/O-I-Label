import { NextResponse } from "next/server";
import { sendNewsletterWelcomeEmail } from "@/lib/email/resend";
import {
  normalizeNewsletterEmail,
  resolveNewsletterPhone,
} from "@/lib/newsletter/subscribe-utils";
import { createServiceRoleClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    email?: unknown;
    phoneLocal?: unknown;
    countryIso?: unknown;
    source?: unknown;
  };

  const emailRaw = typeof b.email === "string" ? b.email.trim() : "";
  const phoneLocal = typeof b.phoneLocal === "string" ? b.phoneLocal.trim() : "";
  const countryIso = typeof b.countryIso === "string" ? b.countryIso.trim().toUpperCase() : "GH";
  const source = typeof b.source === "string" && b.source.trim() ? b.source.trim().slice(0, 64) : "footer";

  if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const phoneResolved = resolveNewsletterPhone(countryIso, phoneLocal);
  if ("error" in phoneResolved) {
    return NextResponse.json({ error: phoneResolved.error }, { status: 400 });
  }

  const email_normalized = normalizeNewsletterEmail(emailRaw);
  const now = new Date().toISOString();

  let service;
  try {
    service = createServiceRoleClient();
  } catch {
    return NextResponse.json(
      { error: "Newsletter signup is temporarily unavailable" },
      { status: 503 }
    );
  }

  const { data: existing } = await service
    .from("newsletter_subscribers")
    .select("id, welcome_email_sent_at")
    .eq("email_normalized", email_normalized)
    .maybeSingle();

  if (existing) {
    const { error: upErr } = await service
      .from("newsletter_subscribers")
      .update({
        email_raw: emailRaw,
        phone_e164: phoneResolved.phoneE164,
        country_iso: phoneResolved.country,
        source,
        updated_at: now,
      })
      .eq("email_normalized", email_normalized);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: true });
  }

  const { error: insErr } = await service.from("newsletter_subscribers").insert({
    email_normalized,
    email_raw: emailRaw,
    phone_e164: phoneResolved.phoneE164,
    country_iso: phoneResolved.country,
    source,
    email_promo_opt_in: true,
    sms_promo_opt_in: true,
    updated_at: now,
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const welcomeDisabled = process.env.NEWSLETTER_WELCOME_EMAIL === "0";
  let welcomed = false;
  if (!welcomeDisabled) {
    const res = await sendNewsletterWelcomeEmail({ to: emailRaw });
    welcomed = Boolean(res.sent);
    if (welcomed) {
      await service
        .from("newsletter_subscribers")
        .update({ welcome_email_sent_at: now })
        .eq("email_normalized", email_normalized);
    }
  }

  return NextResponse.json({ ok: true, welcomeEmail: welcomed ? "sent" : welcomeDisabled ? "disabled" : "skipped" });
}
