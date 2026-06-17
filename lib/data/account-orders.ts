import { linkGuestOrdersToCustomer } from "@/lib/customers/ensure-customer";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export type AccountOrderSummary = {
  id: string;
  order_number: string;
  status: string;
  total_ghs: number;
  created_at: string;
  paid_at: string | null;
  item_count: number;
};

export async function getAccountSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function listAccountOrders(): Promise<{
  user: { id: string; email: string; fullName: string | null } | null;
  orders: AccountOrderSummary[];
}> {
  const { supabase, user } = await getAccountSession();
  if (!user?.email) {
    return { user: null, orders: [] };
  }

  const email = user.email.trim().toLowerCase();
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  const service = createServiceRoleClient();
  await linkGuestOrdersToCustomer(service, user.id, email);

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      status,
      total_ghs,
      created_at,
      paid_at,
      order_items ( quantity )
    `
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[account-orders] list failed:", error.message);
    return { user: { id: user.id, email, fullName }, orders: [] };
  }

  const orders: AccountOrderSummary[] = (data ?? []).map((row) => {
    const items = Array.isArray(row.order_items) ? row.order_items : [];
    const item_count = items.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0);
    return {
      id: String(row.id),
      order_number: String(row.order_number),
      status: String(row.status ?? "pending"),
      total_ghs: Number(row.total_ghs),
      created_at: String(row.created_at),
      paid_at: row.paid_at ? String(row.paid_at) : null,
      item_count,
    };
  });

  return { user: { id: user.id, email, fullName }, orders };
}

export async function getAccountOrderById(orderId: string) {
  const { supabase, user } = await getAccountSession();
  if (!user) return null;

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      status,
      subtotal_ghs,
      shipping_ghs,
      tax_ghs,
      discount_ghs,
      total_ghs,
      created_at,
      paid_at,
      shipping_address,
      order_items ( name, sku, quantity, unit_price_ghs )
    `
    )
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
