import { isUuid } from "@/lib/restock-notifications/helpers";

export type RestockUnsubscribeOutcome =
  | { ok: true; kind: "unsubscribed" | "already_unsubscribed" }
  | { ok: false; kind: "invalid" };

export type RestockUnsubscribeStore = {
  findByToken: (token: string) => Promise<{ id: string; status: string } | null>;
  markUnsubscribed: (subscriptionId: string, updatedAtIso: string) => Promise<void>;
};

/**
 * Process a restock unsubscribe token.
 * Never reveals email or subscription existence details beyond generic outcomes.
 */
export async function processRestockUnsubscribe(
  rawToken: unknown,
  store: RestockUnsubscribeStore
): Promise<RestockUnsubscribeOutcome> {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token || !isUuid(token)) {
    return { ok: false, kind: "invalid" };
  }

  const row = await store.findByToken(token);
  if (!row) {
    return { ok: false, kind: "invalid" };
  }

  if (row.status === "unsubscribed") {
    return { ok: true, kind: "already_unsubscribed" };
  }

  if (row.status !== "active") {
    // notified / cancelled — do not mutate; generic invalid to the user.
    return { ok: false, kind: "invalid" };
  }

  const updatedAt = new Date().toISOString();
  await store.markUnsubscribed(row.id, updatedAt);
  return { ok: true, kind: "unsubscribed" };
}

export function restockUnsubscribeUserMessage(outcome: RestockUnsubscribeOutcome): string {
  if (outcome.ok) {
    return "You've been unsubscribed from restock notifications.";
  }
  return "This unsubscribe link is invalid or no longer available.";
}
