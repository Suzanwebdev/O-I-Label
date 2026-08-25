import { orderItemImageUrl } from "@/lib/email/product-image-url";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  RestockNotifyProduct,
  RestockNotifyStore,
  RestockNotifySubscription,
} from "@/lib/restock-notifications/notify";

type ImageRow = { storage_path: string | null; sort_order: number | null };

function primaryImageUrl(images: ImageRow[] | null | undefined): string {
  const sorted = [...(images ?? [])].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );
  return orderItemImageUrl(sorted[0]?.storage_path ?? null);
}

/** Service-role store for restock notification sends. */
export function createRestockNotifyStore(): RestockNotifyStore {
  const service = createServiceRoleClient();

  return {
    async loadProduct(productId) {
      const { data, error } = await service
        .from("products")
        .select("id, name, slug, is_active, product_images ( storage_path, sort_order )")
        .eq("id", productId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id as string,
        name: String(data.name ?? ""),
        slug: String(data.slug ?? ""),
        isActive: Boolean(data.is_active),
        imageUrl: primaryImageUrl(data.product_images as ImageRow[] | null),
      } satisfies RestockNotifyProduct;
    },

    async listActiveSubscriptions(productId) {
      const { data, error } = await service
        .from("restock_subscriptions")
        .select("id, email_raw, status, unsubscribe_token")
        .eq("product_id", productId)
        .eq("status", "active");

      if (error || !data) return [];

      return data.map(
        (row): RestockNotifySubscription => ({
          id: String(row.id),
          emailRaw: String(row.email_raw ?? ""),
          status: String(row.status ?? ""),
          unsubscribeToken: String(row.unsubscribe_token ?? ""),
        })
      );
    },

    async markNotified(subscriptionId, notifiedAtIso) {
      const { error } = await service
        .from("restock_subscriptions")
        .update({
          status: "notified",
          notified_at: notifiedAtIso,
          updated_at: notifiedAtIso,
        })
        .eq("id", subscriptionId)
        .eq("status", "active");

      if (error) throw new Error(error.message);
    },
  };
}
