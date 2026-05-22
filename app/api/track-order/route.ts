import { NextResponse } from "next/server";
import { lookupOrderForTracking } from "@/lib/data/track-order";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderNumber =
    typeof (body as { orderNumber?: unknown })?.orderNumber === "string"
      ? (body as { orderNumber: string }).orderNumber
      : "";
  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email
      : "";

  if (!orderNumber.trim()) {
    return NextResponse.json({ error: "Order number is required" }, { status: 400 });
  }
  if (!email.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

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
}
