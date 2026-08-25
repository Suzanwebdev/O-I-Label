import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { createRestockSubscriptionStore } from "@/lib/restock-notifications/store";
import { subscribeToRestock } from "@/lib/restock-notifications/subscribe";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "restock:subscribe", 15);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as {
    productId?: unknown;
    email?: unknown;
    preferredColor?: unknown;
    preferredSize?: unknown;
    source?: unknown;
  };

  let store;
  try {
    store = createRestockSubscriptionStore();
  } catch {
    return NextResponse.json(
      { error: "Restock notifications are temporarily unavailable" },
      { status: 503 }
    );
  }

  const result = await subscribeToRestock(
    {
      productId: b.productId,
      email: b.email,
      preferredColor: b.preferredColor,
      preferredSize: b.preferredSize,
      source: b.source,
      customerId: null,
    },
    store
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    alreadySubscribed: result.alreadySubscribed,
  });
}
