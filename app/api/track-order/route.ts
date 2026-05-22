import { NextResponse } from "next/server";
import { lookupOrderForTracking } from "@/lib/data/track-order";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { orderNumber?: unknown; order?: unknown; email?: unknown };
  const orderNumber =
    typeof b.orderNumber === "string"
      ? b.orderNumber
      : typeof b.order === "string"
        ? b.order
        : "";
  const email = typeof b.email === "string" ? b.email : "";

  if (!orderNumber.trim()) {
    return NextResponse.json({ error: "Order number is required" }, { status: 400 });
  }
  if (!email.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    const result = await lookupOrderForTracking(orderNumber, email);
    if (!result) {
      return NextResponse.json(
        {
          error:
            "We could not find an order with that number and email. Check both fields and try again.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, order: result });
  } catch (e) {
    console.error("[track-order] API error:", e);
    return NextResponse.json(
      { error: "Could not look up your order right now. Please try again shortly." },
      { status: 500 }
    );
  }
}
