import { createServiceRoleClient } from "@/lib/supabase/server";
import type { RestockProductRow } from "@/lib/restock-notifications/helpers";
import type { RestockSubscriptionStore } from "@/lib/restock-notifications/subscribe";

function mapProductRow(data: {
  id: string;
  is_active: boolean;
  variants:
    | Array<{ id: string; size: string | null; color: string | null; stock: number | null }>
    | null;
}): RestockProductRow {
  return {
    id: data.id,
    is_active: Boolean(data.is_active),
    variants: (data.variants ?? []).map((v) => ({
      id: v.id,
      size: v.size ?? null,
      color: v.color ?? null,
      stock: Number(v.stock ?? 0),
    })),
  };
}

/** Service-role store for restock subscriptions. Never expose to the browser. */
export function createRestockSubscriptionStore(): RestockSubscriptionStore {
  const service = createServiceRoleClient();

  return {
    async findActiveProduct(productId) {
      const { data, error } = await service
        .from("products")
        .select("id, is_active, variants ( id, size, color, stock )")
        .eq("id", productId)
        .maybeSingle();

      if (error || !data) return null;
      return mapProductRow(data);
    },

    async findActiveSubscription({
      emailNormalized,
      productId,
      preferredColor,
      preferredSize,
    }) {
      let query = service
        .from("restock_subscriptions")
        .select("id")
        .eq("email_normalized", emailNormalized)
        .eq("product_id", productId)
        .eq("status", "active");

      if (preferredColor === null) {
        query = query.is("preferred_color", null);
      } else {
        query = query.eq("preferred_color", preferredColor);
      }

      if (preferredSize === null) {
        query = query.is("preferred_size", null);
      } else {
        query = query.eq("preferred_size", preferredSize);
      }

      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      return { id: data.id as string };
    },

    async insertSubscription(row) {
      const now = new Date().toISOString();
      const { error } = await service.from("restock_subscriptions").insert({
        product_id: row.productId,
        email_normalized: row.emailNormalized,
        email_raw: row.emailRaw,
        customer_id: row.customerId,
        preferred_color: row.preferredColor,
        preferred_size: row.preferredSize,
        status: "active",
        source: row.source,
        unsubscribe_token: row.unsubscribeToken,
        updated_at: now,
      });

      if (!error) return { ok: true };

      const message = error.message?.toLowerCase() ?? "";
      const code = (error as { code?: string }).code;
      if (
        code === "23505" ||
        message.includes("duplicate") ||
        message.includes("unique") ||
        message.includes("idx_restock_subscriptions_active_pref")
      ) {
        return { ok: false, duplicate: true };
      }

      return { ok: false, duplicate: false, error: error.message };
    },
  };
}
