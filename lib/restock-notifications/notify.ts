import type { EmailSendResult } from "@/lib/email/resend";
import {
  buildRestockProductUrl,
  buildRestockUnsubscribeUrl,
} from "@/lib/restock-notifications/urls";

export type RestockNotifySubscription = {
  id: string;
  emailRaw: string;
  status: string;
  unsubscribeToken: string;
};

export type RestockNotifyProduct = {
  id: string;
  name: string;
  slug: string;
  /** Absolute image URL suitable for email clients. */
  imageUrl: string;
  isActive: boolean;
};

export type RestockNotifyStore = {
  loadProduct: (productId: string) => Promise<RestockNotifyProduct | null>;
  listActiveSubscriptions: (productId: string) => Promise<RestockNotifySubscription[]>;
  markNotified: (subscriptionId: string, notifiedAtIso: string) => Promise<void>;
};

export type RestockEmailSender = (opts: {
  to: string;
  productName: string;
  productImageUrl: string;
  productUrl: string;
  unsubscribeUrl: string;
}) => Promise<EmailSendResult>;

export type RestockNotifySummary = {
  productId: string;
  productFound: boolean;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

function isActiveStatus(status: string): boolean {
  return status === "active";
}

/**
 * Notify active restock subscribers for a product.
 * Marks a row notified only after Resend accepts the send.
 * Failed/skipped sends leave the subscription active.
 * Preferred size/colour are not used — product-level only.
 */
export async function notifyRestockSubscribers(
  productId: string,
  store: RestockNotifyStore,
  sendEmail: RestockEmailSender
): Promise<RestockNotifySummary> {
  const summary: RestockNotifySummary = {
    productId,
    productFound: false,
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const product = await store.loadProduct(productId);
  if (!product || !product.isActive || !product.slug.trim()) {
    return summary;
  }
  summary.productFound = true;

  const productUrl = buildRestockProductUrl(product.slug);
  const subscriptions = await store.listActiveSubscriptions(productId);

  for (const sub of subscriptions) {
    if (!isActiveStatus(sub.status)) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;
    const to = sub.emailRaw.trim();
    if (!to) {
      summary.failed += 1;
      continue;
    }

    let result: EmailSendResult;
    try {
      result = await sendEmail({
        to,
        productName: product.name,
        productImageUrl: product.imageUrl,
        productUrl,
        unsubscribeUrl: buildRestockUnsubscribeUrl(sub.unsubscribeToken),
      });
    } catch {
      summary.failed += 1;
      continue;
    }

    if ("sent" in result && result.sent === true) {
      const notifiedAt = new Date().toISOString();
      try {
        await store.markNotified(sub.id, notifiedAt);
        summary.sent += 1;
      } catch {
        // Email went out but status update failed — count as failed so ops can retry carefully.
        summary.failed += 1;
      }
      continue;
    }

    if ("skipped" in result && result.skipped) {
      summary.skipped += 1;
      continue;
    }

    summary.failed += 1;
  }

  return summary;
}
