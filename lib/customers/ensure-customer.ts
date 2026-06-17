import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsureCustomerInput = {
  userId: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
};

/** Upsert a customers row keyed by auth user id. */
export async function ensureCustomerRecord(
  supabase: SupabaseClient,
  input: EnsureCustomerInput
): Promise<{ ok: true; customerId: string } | { ok: false; reason: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, reason: "email_required" };

  const { error } = await supabase.from("customers").upsert(
    {
      id: input.userId,
      email,
      full_name: input.fullName?.trim() || null,
      phone: input.phone?.trim() || null,
    },
    { onConflict: "id" }
  );

  if (error) return { ok: false, reason: error.message };
  return { ok: true, customerId: input.userId };
}

/** Attach past guest orders (same email) to the signed-in customer. */
export async function linkGuestOrdersToCustomer(
  supabase: SupabaseClient,
  customerId: string,
  email: string
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;

  const { data, error } = await supabase
    .from("orders")
    .update({ customer_id: customerId })
    .is("customer_id", null)
    .ilike("email", normalized)
    .select("id");

  if (error) {
    console.warn("[customers] link guest orders failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
