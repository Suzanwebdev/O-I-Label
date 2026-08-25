import { sendRestockAvailableEmail } from "@/lib/email/resend";
import { createRestockNotifyStore } from "@/lib/restock-notifications/notify-store";
import {
  notifyRestockSubscribers,
  type RestockNotifySummary,
} from "@/lib/restock-notifications/notify";

/**
 * Production entry point: notify active restock subscribers for a product.
 * Invoked as a side effect from admin stock updates (Phase 3C).
 */
export async function notifyProductRestock(productId: string): Promise<RestockNotifySummary> {
  return notifyRestockSubscribers(productId, createRestockNotifyStore(), sendRestockAvailableEmail);
}
