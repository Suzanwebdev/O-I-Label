import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  processRestockUnsubscribe,
  restockUnsubscribeUserMessage,
  type RestockUnsubscribeStore,
} from "../lib/restock-notifications/unsubscribe.ts";
import {
  notifyRestockSubscribers,
  type RestockNotifyProduct,
  type RestockNotifyStore,
  type RestockNotifySubscription,
} from "../lib/restock-notifications/notify.ts";
import {
  subscribeToRestock,
  type RestockSubscriptionStore,
} from "../lib/restock-notifications/subscribe.ts";
import type { RestockProductRow } from "../lib/restock-notifications/helpers.ts";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN_ACTIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN_NOTIFIED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOKEN_CANCELLED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TOKEN_UNSUB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type SubRow = {
  id: string;
  status: string;
  token: string;
  emailNormalized: string;
  preferredColor: string | null;
  preferredSize: string | null;
};

function unsubscribeMemory(initial: SubRow[]): {
  store: RestockUnsubscribeStore;
  rows: SubRow[];
  updates: string[];
} {
  const rows = initial.map((r) => ({ ...r }));
  const updates: string[] = [];
  return {
    rows,
    updates,
    store: {
      async findByToken(token) {
        const hit = rows.find((r) => r.token === token);
        return hit ? { id: hit.id, status: hit.status } : null;
      },
      async markUnsubscribed(id, _at) {
        updates.push(id);
        const row = rows.find((r) => r.id === id);
        if (row && row.status === "active") row.status = "unsubscribed";
      },
    },
  };
}

describe("processRestockUnsubscribe", () => {
  it("valid active token → unsubscribed", async () => {
    const { store, rows, updates } = unsubscribeMemory([
      {
        id: "s1",
        status: "active",
        token: TOKEN_ACTIVE,
        emailNormalized: "a@example.com",
        preferredColor: null,
        preferredSize: null,
      },
    ]);
    const outcome = await processRestockUnsubscribe(TOKEN_ACTIVE, store);
    assert.deepEqual(outcome, { ok: true, kind: "unsubscribed" });
    assert.equal(rows[0]?.status, "unsubscribed");
    assert.deepEqual(updates, ["s1"]);
    assert.match(restockUnsubscribeUserMessage(outcome), /unsubscribed from restock/i);
  });

  it("valid notified token → no harmful change", async () => {
    const { store, rows, updates } = unsubscribeMemory([
      {
        id: "s2",
        status: "notified",
        token: TOKEN_NOTIFIED,
        emailNormalized: "a@example.com",
        preferredColor: null,
        preferredSize: null,
      },
    ]);
    const outcome = await processRestockUnsubscribe(TOKEN_NOTIFIED, store);
    assert.equal(outcome.ok, false);
    assert.equal(rows[0]?.status, "notified");
    assert.deepEqual(updates, []);
  });

  it("valid cancelled token → no harmful change", async () => {
    const { store, rows, updates } = unsubscribeMemory([
      {
        id: "s3",
        status: "cancelled",
        token: TOKEN_CANCELLED,
        emailNormalized: "a@example.com",
        preferredColor: null,
        preferredSize: null,
      },
    ]);
    const outcome = await processRestockUnsubscribe(TOKEN_CANCELLED, store);
    assert.equal(outcome.ok, false);
    assert.equal(rows[0]?.status, "cancelled");
    assert.deepEqual(updates, []);
  });

  it("invalid token → no database modification", async () => {
    const { store, updates } = unsubscribeMemory([
      {
        id: "s1",
        status: "active",
        token: TOKEN_ACTIVE,
        emailNormalized: "a@example.com",
        preferredColor: null,
        preferredSize: null,
      },
    ]);
    const outcome = await processRestockUnsubscribe(
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      store
    );
    assert.equal(outcome.ok, false);
    assert.deepEqual(updates, []);
  });

  it("missing token → no database modification", async () => {
    const { store, updates } = unsubscribeMemory([]);
    assert.equal((await processRestockUnsubscribe(null, store)).ok, false);
    assert.equal((await processRestockUnsubscribe("", store)).ok, false);
    assert.equal((await processRestockUnsubscribe("not-a-uuid", store)).ok, false);
    assert.deepEqual(updates, []);
  });

  it("repeated unsubscribe is idempotent", async () => {
    const { store, rows, updates } = unsubscribeMemory([
      {
        id: "s1",
        status: "active",
        token: TOKEN_ACTIVE,
        emailNormalized: "a@example.com",
        preferredColor: null,
        preferredSize: null,
      },
    ]);
    const first = await processRestockUnsubscribe(TOKEN_ACTIVE, store);
    const second = await processRestockUnsubscribe(TOKEN_ACTIVE, store);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.kind, "already_unsubscribed");
    assert.equal(rows[0]?.status, "unsubscribed");
    assert.deepEqual(updates, ["s1"]);
  });
});

describe("subscription lifecycle after notified/unsubscribed", () => {
  const soldOut: RestockProductRow = {
    id: PRODUCT_ID,
    is_active: true,
    variants: [
      { id: "v1", size: "M", color: "Pink", stock: 0 },
      { id: "v2", size: "L", color: "Pink", stock: 0 },
    ],
  };

  function subscribeStore(existingNonActive: Array<{
    emailNormalized: string;
    preferredColor: string | null;
    preferredSize: string | null;
    status: string;
  }>) {
    const active: Array<{
      emailNormalized: string;
      productId: string;
      preferredColor: string | null;
      preferredSize: string | null;
    }> = [];

    const store: RestockSubscriptionStore = {
      async findActiveProduct(id) {
        return id === PRODUCT_ID ? soldOut : null;
      },
      async findActiveSubscription(opts) {
        return active.find(
          (r) =>
            r.emailNormalized === opts.emailNormalized &&
            r.productId === opts.productId &&
            r.preferredColor === opts.preferredColor &&
            r.preferredSize === opts.preferredSize
        )
          ? { id: "active-row" }
          : null;
      },
      async insertSubscription(row) {
        const conflictActive = active.some(
          (r) =>
            r.emailNormalized === row.emailNormalized &&
            r.productId === row.productId &&
            r.preferredColor === row.preferredColor &&
            r.preferredSize === row.preferredSize
        );
        // Partial unique index only on active — non-active history does not block.
        const historyConflict = existingNonActive.some(
          (r) =>
            r.status === "active" &&
            r.emailNormalized === row.emailNormalized &&
            r.preferredColor === row.preferredColor &&
            r.preferredSize === row.preferredSize
        );
        if (conflictActive || historyConflict) return { ok: false, duplicate: true };
        active.push({
          emailNormalized: row.emailNormalized,
          productId: row.productId,
          preferredColor: row.preferredColor,
          preferredSize: row.preferredSize,
        });
        return { ok: true };
      },
    };

    return { store, active };
  }

  it("allows a new active subscription after a prior notified row for same prefs", async () => {
    const { store, active } = subscribeStore([
      {
        emailNormalized: "guest@example.com",
        preferredColor: "Pink",
        preferredSize: "M",
        status: "notified",
      },
    ]);
    const result = await subscribeToRestock(
      {
        productId: PRODUCT_ID,
        email: "guest@example.com",
        preferredColor: "Pink",
        preferredSize: "M",
        source: "pdp",
      },
      store
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.alreadySubscribed, false);
    assert.equal(active.length, 1);
  });

  it("allows a new active subscription after a prior unsubscribed row for same prefs", async () => {
    const { store, active } = subscribeStore([
      {
        emailNormalized: "guest@example.com",
        preferredColor: null,
        preferredSize: null,
        status: "unsubscribed",
      },
    ]);
    const result = await subscribeToRestock(
      {
        productId: PRODUCT_ID,
        email: "guest@example.com",
        preferredColor: "Any",
        preferredSize: "Any",
        source: "pdp",
      },
      store
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.alreadySubscribed, false);
    assert.equal(active.length, 1);
  });
});

describe("notification safety with unsubscribed/notified/inactive", () => {
  const product: RestockNotifyProduct = {
    id: PRODUCT_ID,
    name: "Satin Midi",
    slug: "satin-midi",
    imageUrl: "https://cdn.example.com/x.webp",
    isActive: true,
  };

  it("skips unsubscribed and notified; failed email remains active; success becomes notified", async () => {
    const statuses = new Map<string, string>([
      ["active-ok", "active"],
      ["active-fail", "active"],
      ["was-unsub", "unsubscribed"],
      ["was-notified", "notified"],
    ]);

    // Production listActiveSubscriptions returns only active rows.
    const store: RestockNotifyStore = {
      async loadProduct() {
        return product;
      },
      async listActiveSubscriptions() {
        return [...statuses.entries()]
          .filter(([, status]) => status === "active")
          .map(
            ([id]): RestockNotifySubscription => ({
              id,
              emailRaw: `${id}@example.com`,
              status: "active",
              unsubscribeToken: TOKEN_ACTIVE,
            })
          );
      },
      async markNotified(id) {
        statuses.set(id, "notified");
      },
    };

    const summary = await notifyRestockSubscribers(PRODUCT_ID, store, async (opts) => {
      if (opts.to.startsWith("active-fail")) return { sent: false, error: "bounce" };
      return { sent: true, id: "msg" };
    });

    assert.equal(summary.sent, 1);
    assert.equal(summary.failed, 1);
    assert.equal(statuses.get("active-ok"), "notified");
    assert.equal(statuses.get("active-fail"), "active");
    assert.equal(statuses.get("was-unsub"), "unsubscribed");
    assert.equal(statuses.get("was-notified"), "notified");
  });

  it("does not send notifications for inactive products", async () => {
    let sent = 0;
    const store: RestockNotifyStore = {
      async loadProduct() {
        return { ...product, isActive: false };
      },
      async listActiveSubscriptions() {
        return [
          {
            id: "s1",
            emailRaw: "a@example.com",
            status: "active",
            unsubscribeToken: TOKEN_ACTIVE,
          },
        ];
      },
      async markNotified() {
        throw new Error("should not mark");
      },
    };
    const summary = await notifyRestockSubscribers(PRODUCT_ID, store, async () => {
      sent += 1;
      return { sent: true, id: "msg" };
    });
    assert.equal(summary.productFound, false);
    assert.equal(summary.attempted, 0);
    assert.equal(sent, 0);
  });
});
