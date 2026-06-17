import { NextResponse } from "next/server";
import { handleProviderWebhook } from "@/lib/payments/handle-webhook";
import { enforceRateLimit } from "@/lib/http/rate-limit";

function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "webhooks:moolre", 120);
  if (limited) return limited;

  const rawBody = await request.text();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const url = new URL(request.url);
  const headerSecret = request.headers.get("x-moolre-callback-secret");
  const querySecret = url.searchParams.get("secret") ?? url.searchParams.get("callback_secret");
  const providedSecret =
    headerSecret ?? (isProductionRuntime() ? null : querySecret);
  const result = await handleProviderWebhook("moolre", rawBody, providedSecret, parsedJson);

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ ok: true, idempotent: "idempotent" in result ? result.idempotent : false });
}
