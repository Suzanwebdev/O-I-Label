import { createServiceRoleClient } from "@/lib/supabase/server";

export type NewsletterSubscriberRow = {
  id: string;
  email_raw: string;
  email_normalized: string;
  phone_e164: string;
  country_iso: string;
  source: string;
  email_promo_opt_in: boolean;
  sms_promo_opt_in: boolean;
  welcome_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getNewsletterSubscriberCount(): Promise<number> {
  const service = createServiceRoleClient();
  const { count } = await service
    .from("newsletter_subscribers")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function listNewsletterSubscribers(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: NewsletterSubscriberRow[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const service = createServiceRoleClient();
  let query = service
    .from("newsletter_subscribers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const q = opts.q?.trim();
  if (q) {
    query = query.or(`email_raw.ilike.%${q}%,phone_e164.ilike.%${q}%`);
  }

  const { data, count, error } = await query;
  if (error) return { rows: [], total: 0 };
  return { rows: (data ?? []) as NewsletterSubscriberRow[], total: count ?? 0 };
}
