import { createServiceRoleClient } from "@/lib/supabase/server";
import { normalizeAccessEmail } from "@/lib/store-control/access";
import type { StoreWaitlistRow } from "@/lib/store-control/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeWaitlistEmail(email: string): string {
  return normalizeAccessEmail(email);
}

export async function getWaitlistCount(): Promise<number> {
  const service = createServiceRoleClient();
  const { count } = await service.from("store_waitlist").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function joinStoreWaitlist(input: {
  firstName: string;
  email: string;
  phoneE164?: string | null;
  countryIso?: string;
  source?: string;
  productSlug?: string | null;
}): Promise<{ ok: true; updated: boolean } | { ok: false; error: string }> {
  const firstName = input.firstName.trim();
  const emailRaw = input.email.trim();
  if (!firstName) return { ok: false, error: "First name is required" };
  if (!emailRaw || !EMAIL_RE.test(emailRaw)) return { ok: false, error: "Valid email is required" };

  const email_normalized = normalizeWaitlistEmail(emailRaw);
  const source = (input.source ?? "presale").trim().slice(0, 64);
  const now = new Date().toISOString();

  const service = createServiceRoleClient();
  const { data: existing } = await service
    .from("store_waitlist")
    .select("id")
    .eq("email_normalized", email_normalized)
    .maybeSingle();

  if (existing) {
    const { error } = await service
      .from("store_waitlist")
      .update({
        first_name: firstName,
        email_raw: emailRaw,
        phone_e164: input.phoneE164 ?? null,
        country_iso: input.countryIso ?? "GH",
        source,
        product_slug: input.productSlug ?? null,
        updated_at: now,
      })
      .eq("email_normalized", email_normalized);
    if (error) return { ok: false, error: error.message };
    return { ok: true, updated: true };
  }

  const { error } = await service.from("store_waitlist").insert({
    first_name: firstName,
    email_normalized,
    email_raw: emailRaw,
    phone_e164: input.phoneE164 ?? null,
    country_iso: input.countryIso ?? "GH",
    source,
    product_slug: input.productSlug ?? null,
    updated_at: now,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, updated: false };
}

export async function listWaitlistSubscribers(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: StoreWaitlistRow[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const service = createServiceRoleClient();
  let query = service
    .from("store_waitlist")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const q = opts.q?.trim();
  if (q) {
    query = query.or(`email_raw.ilike.%${q}%,first_name.ilike.%${q}%`);
  }

  const { data, count, error } = await query;
  if (error) return { rows: [], total: 0 };
  return { rows: (data ?? []) as StoreWaitlistRow[], total: count ?? 0 };
}

export async function listWaitlistEmailsForCampaign(): Promise<string[]> {
  const service = createServiceRoleClient();
  const { data } = await service.from("store_waitlist").select("email_raw");
  return (data ?? []).map((r) => String(r.email_raw)).filter(Boolean);
}
