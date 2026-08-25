import { createServiceRoleClient } from "@/lib/supabase/server";
import type { RestockUnsubscribeStore } from "@/lib/restock-notifications/unsubscribe";

export function createRestockUnsubscribeStore(): RestockUnsubscribeStore {
  const service = createServiceRoleClient();

  return {
    async findByToken(token) {
      const { data, error } = await service
        .from("restock_subscriptions")
        .select("id, status")
        .eq("unsubscribe_token", token)
        .maybeSingle();

      if (error || !data) return null;
      return { id: String(data.id), status: String(data.status ?? "") };
    },

    async markUnsubscribed(subscriptionId, updatedAtIso) {
      const { error } = await service
        .from("restock_subscriptions")
        .update({
          status: "unsubscribed",
          updated_at: updatedAtIso,
        })
        .eq("id", subscriptionId)
        .eq("status", "active");

      if (error) throw new Error(error.message);
    },
  };
}
