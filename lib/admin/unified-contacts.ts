import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AdminContactSource, AdminCustomerRow, AdminCustomersKpi } from "@/lib/data/admin";

function normalizeContactEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function contactListId(opts: {
  customerId?: string | null;
  email?: string | null;
  phone?: string | null;
}): string | null {
  if (opts.customerId?.trim()) return opts.customerId.trim();
  const email = normalizeContactEmail(opts.email);
  if (email) return `e:${email}`;
  const phone = (opts.phone ?? "").replace(/\D/g, "");
  if (phone) return `p:${phone}`;
  return null;
}

function earliestIso(a: string | null | undefined, b: string | null | undefined): string {
  if (!a) return b || new Date(0).toISOString();
  if (!b) return a;
  return a < b ? a : b;
}

function nameFromShippingAddress(address: unknown): string | null {
  if (!address || typeof address !== "object") return null;
  const a = address as { first_name?: unknown; last_name?: unknown };
  const first = typeof a.first_name === "string" ? a.first_name.trim() : "";
  const last = typeof a.last_name === "string" ? a.last_name.trim() : "";
  const full = `${first} ${last}`.trim();
  return full || null;
}

type MutableContact = {
  id: string;
  customerId: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  tags: Set<string>;
  sources: Set<AdminContactSource>;
  total_spend_ghs: number;
  orders_count: number;
  last_order_at: string | null;
  created_at: string;
};

function upsertContact(
  byKey: Map<string, MutableContact>,
  emailIndex: Map<string, string>,
  input: {
    customerId?: string | null;
    email?: string | null;
    phone?: string | null;
    full_name?: string | null;
    tags?: string[];
    source: AdminContactSource;
    spend?: number;
    orderStamp?: string | null;
    created_at?: string | null;
    countOrder?: boolean;
  }
) {
  const email = normalizeContactEmail(input.email);
  const phone = input.phone?.trim() || null;
  const preferredId = contactListId({
    customerId: input.customerId,
    email,
    phone,
  });
  if (!preferredId) return;

  const indexedId = email ? emailIndex.get(email) : undefined;
  let existing =
    byKey.get(preferredId) ||
    (indexedId ? byKey.get(indexedId) : undefined) ||
    undefined;

  if (!existing) {
    existing = {
      id: preferredId,
      customerId: input.customerId?.trim() || null,
      email: email || "",
      full_name: input.full_name?.trim() || null,
      phone,
      tags: new Set(input.tags ?? []),
      sources: new Set([input.source]),
      total_spend_ghs: 0,
      orders_count: 0,
      last_order_at: null,
      created_at: input.created_at || new Date(0).toISOString(),
    };
  } else {
    const previousId = existing.id;
    if (input.customerId?.trim()) {
      existing.customerId = input.customerId.trim();
      existing.id = input.customerId.trim();
    }
    if (!existing.email && email) existing.email = email;
    if (!existing.phone && phone) existing.phone = phone;
    if (!existing.full_name && input.full_name?.trim()) {
      existing.full_name = input.full_name.trim();
    }
    existing.created_at = earliestIso(existing.created_at, input.created_at);
    for (const tag of input.tags ?? []) existing.tags.add(tag);
    if (previousId !== existing.id) byKey.delete(previousId);
  }

  existing.sources.add(input.source);
  if (input.countOrder) {
    existing.orders_count += 1;
    existing.total_spend_ghs += Number(input.spend ?? 0);
    const stamp = input.orderStamp ?? null;
    if (stamp && (!existing.last_order_at || stamp > existing.last_order_at)) {
      existing.last_order_at = stamp;
    }
  }

  byKey.set(existing.id, existing);
  if (existing.email) emailIndex.set(existing.email, existing.id);
}

/** Unified CRM contacts: accounts, orders, VIP waitlist, and newsletter. */
export async function listUnifiedAdminContacts(): Promise<AdminCustomerRow[]> {
  const supabase = createServiceRoleClient();
  const [{ data: customers }, { data: orders }, { data: waitlist }, { data: newsletter }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, email, full_name, phone, tags, total_spend_ghs, created_at")
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase
        .from("orders")
        .select("id, customer_id, email, phone, total_ghs, created_at, shipping_address")
        .order("created_at", { ascending: false })
        .limit(8000),
      supabase
        .from("store_waitlist")
        .select("id, first_name, email_normalized, email_raw, phone_e164, source, created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("newsletter_subscribers")
        .select("id, email_normalized, email_raw, phone_e164, source, created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

  const byKey = new Map<string, MutableContact>();
  const emailIndex = new Map<string, string>();

  for (const c of customers ?? []) {
    upsertContact(byKey, emailIndex, {
      customerId: c.id,
      email: c.email,
      phone: c.phone,
      full_name: c.full_name,
      tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === "string") : [],
      source: "account",
      created_at: c.created_at,
    });
  }

  for (const order of orders ?? []) {
    upsertContact(byKey, emailIndex, {
      customerId: order.customer_id,
      email: order.email,
      phone: order.phone,
      full_name: nameFromShippingAddress(order.shipping_address),
      source: "order",
      spend: Number(order.total_ghs ?? 0),
      orderStamp: order.created_at,
      created_at: order.created_at,
      countOrder: true,
    });
  }

  for (const row of waitlist ?? []) {
    upsertContact(byKey, emailIndex, {
      email: row.email_normalized || row.email_raw,
      phone: row.phone_e164,
      full_name: row.first_name,
      tags: row.source ? [`waitlist:${row.source}`] : ["waitlist"],
      source: "waitlist",
      created_at: row.created_at,
    });
  }

  for (const row of newsletter ?? []) {
    upsertContact(byKey, emailIndex, {
      email: row.email_normalized || row.email_raw,
      phone: row.phone_e164,
      tags: row.source ? [`newsletter:${row.source}`] : ["newsletter"],
      source: "newsletter",
      created_at: row.created_at,
    });
  }

  return [...byKey.values()]
    .map((c) => ({
      id: c.id,
      customerId: c.customerId,
      email: c.email,
      full_name: c.full_name,
      phone: c.phone,
      tags: Array.from(c.tags),
      sources: Array.from(c.sources),
      total_spend_ghs: c.total_spend_ghs,
      orders_count: c.orders_count,
      last_order_at: c.last_order_at,
      created_at: c.created_at,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function summarizeUnifiedContacts(customers: AdminCustomerRow[]): AdminCustomersKpi {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let totalSpend = 0;
  let repeat = 0;
  let highValue = 0;
  let new30d = 0;
  let accounts = 0;
  let waitlist = 0;
  let newsletter = 0;
  let withOrders = 0;

  for (const c of customers) {
    totalSpend += c.total_spend_ghs;
    if (c.orders_count >= 2) repeat += 1;
    if (c.total_spend_ghs >= 1000) highValue += 1;
    if (new Date(c.created_at).getTime() >= since) new30d += 1;
    if (c.sources.includes("account")) accounts += 1;
    if (c.sources.includes("waitlist")) waitlist += 1;
    if (c.sources.includes("newsletter")) newsletter += 1;
    if (c.orders_count > 0 || c.sources.includes("order")) withOrders += 1;
  }

  return {
    total: customers.length,
    new30d,
    repeat,
    highValue,
    avgLifetimeValue: customers.length ? totalSpend / customers.length : 0,
    accounts,
    waitlist,
    newsletter,
    withOrders,
  };
}
