import { NextResponse } from "next/server";
import { handleProviderWebhook } from "@/lib/payments/handle-webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const headerSecret = request.headers.get("x-moolre-callback-secret");
  const result = await handleProviderWebhook("moolre", rawBody, headerSecret, parsedJson);

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ ok: true, idempotent: "idempotent" in result ? result.idempotent : false });
}
