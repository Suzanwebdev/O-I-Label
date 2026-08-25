import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  renderRestockAvailableEmail,
  restockAvailableEmailSubject,
} from "../lib/email/templates/restock-available.ts";
import type { EmailFooterLinks } from "../lib/email/brand.ts";
import {
  notifyRestockSubscribers,
  type RestockEmailSender,
  type RestockNotifyProduct,
  type RestockNotifyStore,
  type RestockNotifySubscription,
} from "../lib/restock-notifications/notify.ts";
import {
  buildRestockProductUrl,
  buildRestockUnsubscribeUrl,
} from "../lib/restock-notifications/urls.ts";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const FOOTER: EmailFooterLinks = {
  contact: "https://example.com/contact",
  trackOrder: "https://example.com/track-order",
  returns: "https://example.com/policies/returns",
  shipping: "https://example.com/policies/shipping",
  shop: "https://example.com/shop",
  instagram: "https://www.instagram.com/o_and_i_label/",
  supportEmail: "hello@example.com",
};

const PRODUCT: RestockNotifyProduct = {
  id: PRODUCT_ID,
  name: "Satin Midi Dress",
  slug: "satin-midi-dress",
  imageUrl: "https://cdn.example.com/catalog/satin.webp",
  isActive: true,
};

function sub(
  overrides: Partial<RestockNotifySubscription> & { id: string; emailRaw: string }
): RestockNotifySubscription {
  return {
    status: "active",
    unsubscribeToken: `token-${overrides.id}`,
    ...overrides,
  };
}

function memoryStore(opts: {
  product?: RestockNotifyProduct | null;
  subscriptions: RestockNotifySubscription[];
}): {
  store: RestockNotifyStore;
  notified: Array<{ id: string; at: string }>;
  listCalls: number;
} {
  let subscriptions = [...opts.subscriptions];
  const notified: Array<{ id: string; at: string }> = [];
  let listCalls = 0;

  return {
    notified,
    get listCalls() {
      return listCalls;
    },
    store: {
      async loadProduct(id) {
        if (opts.product === null) return null;
        const product = opts.product ?? PRODUCT;
        return product.id === id ? product : null;
      },
      async listActiveSubscriptions(productId) {
        listCalls += 1;
        return subscriptions.filter((s) => s.status === "active" && productId === PRODUCT_ID);
      },
      async markNotified(id, at) {
        notified.push({ id, at });
        subscriptions = subscriptions.map((s) =>
          s.id === id ? { ...s, status: "notified" } : s
        );
      },
    },
  };
}

describe("restock email template", () => {
  it("includes product name, image, shop link, and unsubscribe without preference copy", () => {
    const html = renderRestockAvailableEmail(
      {
        productName: "Satin Midi Dress",
        productImageUrl: "https://cdn.example.com/catalog/satin.webp",
        productUrl: "https://example.com/product/satin-midi-dress",
        unsubscribeUrl:
          "https://example.com/api/restock-notifications/unsubscribe?token=abc",
      },
      FOOTER
    );

    assert.match(html, /Satin Midi Dress/);
    assert.match(html, /cdn\.example\.com\/catalog\/satin\.webp/);
    assert.match(html, /\/product\/satin-midi-dress/);
    assert.match(html, /Shop now/i);
    assert.match(html, /unsubscribe\?token=abc/i);
    assert.match(html, /available again/i);
    assert.doesNotMatch(html, /preferred size/i);
    assert.doesNotMatch(html, /Pink \/ M/i);
    assert.match(restockAvailableEmailSubject("Satin Midi Dress"), /back in stock/i);
  });
});

describe("restock URL builders", () => {
  it("builds product and unsubscribe URLs from the app base URL", () => {
    const prev = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://shop.example.test";
    try {
      assert.equal(
        buildRestockProductUrl("satin-midi-dress"),
        "https://shop.example.test/product/satin-midi-dress"
      );
      assert.equal(
        buildRestockUnsubscribeUrl("tok-123"),
        "https://shop.example.test/api/restock-notifications/unsubscribe?token=tok-123"
      );
    } finally {
      if (prev === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = prev;
    }
  });
});

describe("notifyRestockSubscribers", () => {
  it("sends to active subscribers and marks them notified", async () => {
    const { store, notified } = memoryStore({
      subscriptions: [sub({ id: "s1", emailRaw: "a@example.com" })],
    });
    const sentPayloads: Array<Parameters<RestockEmailSender>[0]> = [];
    const send: RestockEmailSender = async (opts) => {
      sentPayloads.push(opts);
      return { sent: true, id: "msg-1" };
    };

    const summary = await notifyRestockSubscribers(PRODUCT_ID, store, send);
    assert.equal(summary.sent, 1);
    assert.equal(summary.failed, 0);
    assert.equal(notified.length, 1);
    assert.equal(notified[0]?.id, "s1");
    assert.equal(sentPayloads[0]?.to, "a@example.com");
    assert.equal(sentPayloads[0]?.productName, "Satin Midi Dress");
    assert.equal(sentPayloads[0]?.productImageUrl, PRODUCT.imageUrl);
    assert.match(sentPayloads[0]?.productUrl ?? "", /\/product\/satin-midi-dress$/);
    assert.match(sentPayloads[0]?.unsubscribeUrl ?? "", /token-s1/);
  });

  it("skips notified, unsubscribed, and cancelled subscribers", async () => {
    const { store, notified } = memoryStore({
      subscriptions: [
        sub({ id: "active", emailRaw: "active@example.com", status: "active" }),
        sub({ id: "done", emailRaw: "done@example.com", status: "notified" }),
        sub({ id: "out", emailRaw: "out@example.com", status: "unsubscribed" }),
        sub({ id: "cancel", emailRaw: "cancel@example.com", status: "cancelled" }),
      ],
    });

    // listActiveSubscriptions already filters to active in the real store;
    // simulate a store that only returns active rows (as production does).
    const productionLike: RestockNotifyStore = {
      loadProduct: store.loadProduct,
      listActiveSubscriptions: async (id) =>
        (await store.listActiveSubscriptions(id)).filter((s) => s.status === "active"),
      markNotified: store.markNotified,
    };

    const sent: string[] = [];
    const summary = await notifyRestockSubscribers(PRODUCT_ID, productionLike, async (opts) => {
      sent.push(opts.to);
      return { sent: true, id: "ok" };
    });

    assert.deepEqual(sent, ["active@example.com"]);
    assert.equal(summary.sent, 1);
    assert.equal(notified.map((n) => n.id).join(","), "active");
  });

  it("leaves status active when email send fails", async () => {
    const { store, notified } = memoryStore({
      subscriptions: [sub({ id: "s1", emailRaw: "a@example.com" })],
    });
    const summary = await notifyRestockSubscribers(PRODUCT_ID, store, async () => ({
      sent: false,
      error: "Resend timeout",
    }));
    assert.equal(summary.failed, 1);
    assert.equal(summary.sent, 0);
    assert.equal(notified.length, 0);
  });

  it("handles multiple subscribers independently", async () => {
    const { store, notified } = memoryStore({
      subscriptions: [
        sub({ id: "ok1", emailRaw: "ok1@example.com" }),
        sub({ id: "bad", emailRaw: "bad@example.com" }),
        sub({ id: "ok2", emailRaw: "ok2@example.com" }),
      ],
    });

    const summary = await notifyRestockSubscribers(PRODUCT_ID, store, async (opts) => {
      if (opts.to.startsWith("bad")) return { sent: false, error: "bounce" };
      return { sent: true, id: "msg" };
    });

    assert.equal(summary.attempted, 3);
    assert.equal(summary.sent, 2);
    assert.equal(summary.failed, 1);
    assert.deepEqual(
      notified.map((n) => n.id).sort(),
      ["ok1", "ok2"]
    );
  });

  it("does not mark other subscribers notified when one send fails", async () => {
    const { store, notified } = memoryStore({
      subscriptions: [
        sub({ id: "fail", emailRaw: "fail@example.com" }),
        sub({ id: "ok", emailRaw: "ok@example.com" }),
      ],
    });

    await notifyRestockSubscribers(PRODUCT_ID, store, async (opts) => {
      if (opts.to.startsWith("fail")) return { sent: false, error: "nope" };
      return { sent: true, id: "msg" };
    });

    assert.deepEqual(
      notified.map((n) => n.id),
      ["ok"]
    );
  });

  it("does not resend to already-notified subscribers on duplicate invocation", async () => {
    const { store, notified } = memoryStore({
      subscriptions: [sub({ id: "s1", emailRaw: "a@example.com" })],
    });

    let sendCount = 0;
    const send: RestockEmailSender = async () => {
      sendCount += 1;
      return { sent: true, id: "msg" };
    };

    const first = await notifyRestockSubscribers(PRODUCT_ID, store, send);
    const second = await notifyRestockSubscribers(PRODUCT_ID, store, send);

    assert.equal(first.sent, 1);
    assert.equal(second.sent, 0);
    assert.equal(second.attempted, 0);
    assert.equal(sendCount, 1);
    assert.equal(notified.length, 1);
  });

  it("skips when Resend is not configured (sent result skipped) and leaves active", async () => {
    const { store, notified } = memoryStore({
      subscriptions: [sub({ id: "s1", emailRaw: "a@example.com" })],
    });
    const summary = await notifyRestockSubscribers(PRODUCT_ID, store, async () => ({
      skipped: true,
      reason: "RESEND_API_KEY not configured",
    }));
    assert.equal(summary.skipped, 1);
    assert.equal(summary.sent, 0);
    assert.equal(notified.length, 0);
  });

  it("returns early when product is missing", async () => {
    const { store, notified } = memoryStore({
      product: null,
      subscriptions: [sub({ id: "s1", emailRaw: "a@example.com" })],
    });
    const summary = await notifyRestockSubscribers(PRODUCT_ID, store, async () => {
      throw new Error("should not send");
    });
    assert.equal(summary.productFound, false);
    assert.equal(summary.attempted, 0);
    assert.equal(notified.length, 0);
  });
});
